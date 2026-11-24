using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dapper;
using EdunovaPlatform.Api.Models;
using EdunovaPlatform.Api.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on 0.0.0.0:4500 (or PORT env var)
var port = Environment.GetEnvironmentVariable("PORT") ?? "4500";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin()
         .AllowAnyMethod()
         .AllowAnyHeader());
});

builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddSingleton<AuthService>();

var app = builder.Build();

app.UseCors("AllowAll");

// Initialize Database connection & seed admin
var db = app.Services.GetRequiredService<DatabaseService>();
await db.InitializeAsync();

var auth = app.Services.GetRequiredService<AuthService>();
var config = app.Configuration;

// Ensure directories
var uploadsDir = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "uploads"));
Directory.CreateDirectory(uploadsDir);
Directory.CreateDirectory(Path.Combine(uploadsDir, "receipts"));
Directory.CreateDirectory(Path.Combine(uploadsDir, "courses"));

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads"
});

// Serve frontend SPA if available
var candidateSpaDirs = new[]
{
    Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, config["Paths:SpaDist"] ?? "../app-ui/dist")),
    Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../../app-ui/dist")),
    Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "wwwroot")),
    @"D:\data\edunova-apps-platform\app-ui\dist"
};

var spaDist = candidateSpaDirs.FirstOrDefault(Directory.Exists);
if (!string.IsNullOrEmpty(spaDist) && Directory.Exists(spaDist))
{
    var spaProvider = new PhysicalFileProvider(spaDist);
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = spaProvider
    });
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = spaProvider,
        RequestPath = ""
    });
}

// ---------------------------------------------------------------------------
// Helper: Authenticate Request from Bearer Token
// ---------------------------------------------------------------------------
AppUser? GetUserFromContext(HttpContext context)
{
    string? authHeader = context.Request.Headers["Authorization"];
    if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        return null;
    }

    var token = authHeader.Substring("Bearer ".Length).Trim();
    var principal = auth.ValidateToken(token);
    if (principal == null) return null;

    var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(userId)) return null;

    using var conn = db.CreateConnection();
    return conn.QueryFirstOrDefault<AppUser>("SELECT * FROM app_users WHERE id = @userId::uuid LIMIT 1;", new { userId });
}

bool RequireAdmin(HttpContext context, out AppUser? admin, out IResult? error)
{
    admin = GetUserFromContext(context);
    if (admin == null || admin.role != "admin" || admin.is_banned)
    {
        error = Results.Json(new { error = "غير مصرّح — مطلوب حساب مسؤول (Admin)" }, statusCode: 403);
        return false;
    }
    error = null;
    return true;
}

bool RequireStudent(HttpContext context, out AppUser? user, out IResult? error)
{
    user = GetUserFromContext(context);
    if (user == null || user.is_banned)
    {
        error = Results.Json(new { error = "يجب تسجيل الدخول أولاً" }, statusCode: 401);
        return false;
    }
    error = null;
    return true;
}

// ---------------------------------------------------------------------------
// 1. Health & Config Endpoints
// ---------------------------------------------------------------------------
app.MapGet("/api/health", async () =>
{
    using var conn = db.CreateConnection();
    var cfg = await conn.QueryFirstOrDefaultAsync<AppConfig>("SELECT * FROM app_config LIMIT 1;") ?? new AppConfig();
    return Results.Ok(new
    {
        ok = true,
        service = "edunova-csharp-apps-server",
        language = "C# (.NET 9.0)",
        engine = "Kestrel Native",
        db = "Neon PostgreSQL 18",
        config = cfg,
        timestamp = DateTime.UtcNow
    });
});

app.MapGet("/api/config", async () =>
{
    using var conn = db.CreateConnection();
    var cfg = await conn.QueryFirstOrDefaultAsync<AppConfig>("SELECT * FROM app_config LIMIT 1;") ?? new AppConfig();
    return Results.Ok(cfg);
});

// ---------------------------------------------------------------------------
// 2. Auth Endpoints
// ---------------------------------------------------------------------------
app.MapPost("/api/auth/register", async (HttpContext ctx) =>
{
    try
    {
        using var reader = new StreamReader(ctx.Request.Body);
        var json = await reader.ReadToEndAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var name = root.TryGetProperty("name", out var n) ? n.GetString()?.Trim() : "";
        var email = root.TryGetProperty("email", out var e) ? e.GetString()?.Trim().ToLower() : "";
        var password = root.TryGetProperty("password", out var p) ? p.GetString()?.Trim() : "";
        var phone = root.TryGetProperty("phone", out var ph) ? ph.GetString()?.Trim() : "";
        var deviceId = root.TryGetProperty("deviceId", out var d) ? d.GetString()?.Trim() : "";
        var userAgent = root.TryGetProperty("userAgent", out var ua) ? ua.GetString()?.Trim() : ctx.Request.Headers.UserAgent.ToString();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            return Results.BadRequest(new { error = "يُرجى إدخال جميع البيانات المطلوبة وكلمة مرور من 6 أحرف على الأقل" });
        }

        using var conn = db.CreateConnection();
        var existing = await conn.QueryFirstOrDefaultAsync<AppUser>("SELECT id FROM app_users WHERE email = @email;", new { email });
        if (existing != null)
        {
            return Results.BadRequest(new { error = "هذا البريد الإلكتروني مسجّل بالفعل، يُرجى تسجيل الدخول" });
        }

        var user = new AppUser
        {
            id = Guid.NewGuid().ToString(),
            name = name,
            email = email,
            password_hash = auth.HashPassword(password),
            role = "student",
            phone = phone,
            last_seen_at = DateTime.UtcNow
        };

        await conn.ExecuteAsync(@"
            INSERT INTO app_users (id, name, email, password_hash, role, phone, is_banned, last_seen_at)
            VALUES (@id::uuid, @name, @email, @password_hash, @role, @phone, false, @last_seen_at);
        ", user);

        // Bind device
        if (!string.IsNullOrEmpty(deviceId))
        {
            await auth.VerifyOrBindDeviceAsync(user.id, user.role, deviceId, userAgent ?? "");
        }

        var token = auth.GenerateToken(user);
        return Results.Ok(new
        {
            token,
            user = new { user.id, user.name, user.email, user.role, user.phone }
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapPost("/api/auth/login", async (HttpContext ctx) =>
{
    try
    {
        using var reader = new StreamReader(ctx.Request.Body);
        var json = await reader.ReadToEndAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var email = root.TryGetProperty("email", out var e) ? e.GetString()?.Trim().ToLower() : "";
        var password = root.TryGetProperty("password", out var p) ? p.GetString()?.Trim() : "";
        var deviceId = root.TryGetProperty("deviceId", out var d) ? d.GetString()?.Trim() : "";
        var userAgent = root.TryGetProperty("userAgent", out var ua) ? ua.GetString()?.Trim() : ctx.Request.Headers.UserAgent.ToString();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return Results.BadRequest(new { error = "يُرجى إدخال البريد الإلكتروني وكلمة المرور" });
        }

        using var conn = db.CreateConnection();
        var user = await conn.QueryFirstOrDefaultAsync<AppUser>("SELECT * FROM app_users WHERE email = @email;", new { email });
        if (user == null || !auth.VerifyPassword(password, user.password_hash))
        {
            return Results.BadRequest(new { error = "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
        }

        if (user.is_banned)
        {
            return Results.Json(new { error = "تم حظر هذا الحساب من قِبل إدارة المنصة" }, statusCode: 403);
        }

        // Verify Device Lock for students
        if (user.role != "admin" && !string.IsNullOrEmpty(deviceId))
        {
            var deviceError = await auth.VerifyOrBindDeviceAsync(user.id, user.role, deviceId, userAgent ?? "");
            if (deviceError != null)
            {
                return Results.Json(new { error = deviceError }, statusCode: 403);
            }
        }

        // Update last seen
        await conn.ExecuteAsync("UPDATE app_users SET last_seen_at = @now WHERE id = @id::uuid;", new { now = DateTime.UtcNow, id = user.id });

        var token = auth.GenerateToken(user);
        return Results.Ok(new
        {
            token,
            user = new { user.id, user.name, user.email, user.role, user.phone }
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapGet("/api/auth/me", async (HttpContext ctx) =>
{
    var user = GetUserFromContext(ctx);
    if (user == null) return Results.Unauthorized();

    using var conn = db.CreateConnection();
    var cfg = await conn.QueryFirstOrDefaultAsync<AppConfig>("SELECT * FROM app_config LIMIT 1;") ?? new AppConfig();
    return Results.Ok(new
    {
        user = new { user.id, user.name, user.email, user.role, user.phone, user.is_banned },
        config = cfg
    });
});

// ---------------------------------------------------------------------------
// 3. Student Workspace Endpoints
// ---------------------------------------------------------------------------
app.MapGet("/api/student/courses", async (HttpContext ctx) =>
{
    if (!RequireStudent(ctx, out var user, out var err)) return err!;

    using var conn = db.CreateConnection();

    var courses = (await conn.QueryAsync<AppCourse>(
        "SELECT * FROM app_courses WHERE is_published = true ORDER BY created_at DESC;")).AsList();

    var enrolledCourseIds = (await conn.QueryAsync<string>(
        "SELECT course_id FROM app_enrollments WHERE user_id = @userId::uuid;",
        new { userId = user!.id })).ToHashSet();

    var completedLessons = (await conn.QueryAsync<string>(
        "SELECT lesson_id FROM app_lesson_progress WHERE user_id = @userId::uuid AND is_completed = true;",
        new { userId = user!.id })).ToHashSet();

    var lessons = (await conn.QueryAsync<AppLesson>("SELECT id, course_id FROM app_lessons;")).AsList();

    var result = courses.Select(c =>
    {
        var courseLessons = lessons.Where(l => l.course_id == c.id).ToList();
        var completedCount = courseLessons.Count(l => completedLessons.Contains(l.id));
        var isEnrolled = enrolledCourseIds.Contains(c.id);

        return new
        {
            c.id,
            c.title,
            c.description,
            c.price,
            c.thumbnail_url,
            is_enrolled = isEnrolled,
            total_lessons = courseLessons.Count,
            completed_lessons = completedCount,
            progress_percent = courseLessons.Count > 0 ? Math.Round((double)completedCount / courseLessons.Count * 100) : 0
        };
    });

    return Results.Ok(result);
});

app.MapGet("/api/student/courses/{courseId}", async (string courseId, HttpContext ctx) =>
{
    if (!RequireStudent(ctx, out var user, out var err)) return err!;

    using var conn = db.CreateConnection();
    var course = await conn.QueryFirstOrDefaultAsync<AppCourse>(
        "SELECT * FROM app_courses WHERE id = @courseId::uuid;", new { courseId });

    if (course == null) return Results.NotFound(new { error = "الكورس غير موجود" });

    bool isEnrolled = await conn.ExecuteScalarAsync<bool>(
        "SELECT COUNT(1) > 0 FROM app_enrollments WHERE user_id = @userId::uuid AND course_id = @courseId::uuid;",
        new { userId = user!.id, courseId });

    var sections = (await conn.QueryAsync<AppSection>(
        "SELECT * FROM app_sections WHERE course_id = @courseId::uuid ORDER BY sort_order ASC;",
        new { courseId })).AsList();

    var lessons = (await conn.QueryAsync<AppLesson>(
        "SELECT * FROM app_lessons WHERE course_id = @courseId::uuid ORDER BY sort_order ASC;",
        new { courseId })).AsList();

    var completedLessonIds = (await conn.QueryAsync<string>(
        "SELECT lesson_id FROM app_lesson_progress WHERE user_id = @userId::uuid AND is_completed = true;",
        new { userId = user!.id })).ToHashSet();

    var sectionsWithLessons = sections.Select(s => new
    {
        s.id,
        s.title,
        s.sort_order,
        lessons = lessons.Where(l => l.section_id == s.id).Select(l => new
        {
            l.id,
            l.title,
            l.description,
            l.duration_minutes,
            l.sort_order,
            l.is_free_preview,
            is_completed = completedLessonIds.Contains(l.id),
            video_id = (isEnrolled || l.is_free_preview) ? l.video_id : null,
            is_locked = !isEnrolled && !l.is_free_preview
        })
    });

    return Results.Ok(new
    {
        course,
        is_enrolled = isEnrolled,
        sections = sectionsWithLessons
    });
});

app.MapPost("/api/student/lessons/{lessonId}/complete", async (string lessonId, HttpContext ctx) =>
{
    if (!RequireStudent(ctx, out var user, out var err)) return err!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        INSERT INTO app_lesson_progress (id, user_id, lesson_id, is_completed, updated_at)
        VALUES (@id::uuid, @userId::uuid, @lessonId::uuid, true, @now)
        ON CONFLICT (user_id, lesson_id) DO UPDATE 
        SET is_completed = true, updated_at = @now;
    ", new
    {
        id = Guid.NewGuid().ToString(),
        userId = user!.id,
        lessonId,
        now = DateTime.UtcNow
    });

    return Results.Ok(new { ok = true, completed = true });
});

app.MapPost("/api/student/enroll-code", async (HttpContext ctx) =>
{
    if (!RequireStudent(ctx, out var user, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var code = doc.RootElement.TryGetProperty("code", out var c) ? c.GetString()?.Trim().ToUpper() : "";

    if (string.IsNullOrWhiteSpace(code)) return Results.BadRequest(new { error = "يُرجى إدخال كود التفعيل" });

    using var conn = db.CreateConnection();
    var codeRow = await conn.QueryFirstOrDefaultAsync<AppActivationCode>(
        "SELECT * FROM app_activation_codes WHERE code = @code;", new { code });

    if (codeRow == null) return Results.BadRequest(new { error = "كود التفعيل غير صالح أو غير موجود" });
    if (codeRow.is_used) return Results.BadRequest(new { error = "تم استخدام هذا الكود من قبل" });

    await conn.ExecuteAsync(@"
        UPDATE app_activation_codes 
        SET is_used = true, used_by_user_id = @userId::uuid, used_at = @now 
        WHERE id = @id::uuid;
    ", new { userId = user!.id, now = DateTime.UtcNow, id = codeRow.id });

    await conn.ExecuteAsync(@"
        INSERT INTO app_enrollments (id, user_id, course_id, enrolled_at)
        VALUES (@id::uuid, @userId::uuid, @courseId::uuid, @now)
        ON CONFLICT (user_id, course_id) DO NOTHING;
    ", new { id = Guid.NewGuid().ToString(), userId = user!.id, courseId = codeRow.course_id, now = DateTime.UtcNow });

    return Results.Ok(new { ok = true, message = "تم تفعيل الكورس بنجاح! مبروك 🎉" });
});

app.MapPost("/api/student/upload-receipt", async (HttpContext ctx) =>
{
    if (!RequireStudent(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var dataUrl = doc.RootElement.TryGetProperty("dataUrl", out var du) ? du.GetString() : "";

    if (string.IsNullOrWhiteSpace(dataUrl)) return Results.BadRequest(new { error = "صورة الإيصال مفقودة" });

    var match = Regex.Match(dataUrl, @"^data:image\/(png|jpeg|jpg|webp);base64,(.+)$");
    if (!match.Success) return Results.BadRequest(new { error = "صيغة الصورة غير مدعومة" });

    var ext = match.Groups[1].Value.Replace("jpeg", "jpg");
    var base64 = match.Groups[2].Value;
    var bytes = Convert.FromBase64String(base64);

    var fileName = $"receipt_{Guid.NewGuid():N}.{ext}";
    var filePath = Path.Combine(uploadsDir, "receipts", fileName);
    await File.WriteAllBytesAsync(filePath, bytes);

    return Results.Ok(new { url = $"/uploads/receipts/{fileName}" });
});

app.MapPost("/api/student/payment-requests", async (HttpContext ctx) =>
{
    if (!RequireStudent(ctx, out var user, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var root = doc.RootElement;

    var courseId = root.GetProperty("courseId").GetString()!;
    var amount = root.TryGetProperty("amount", out var am) ? am.GetDecimal() : 0;
    var paymentMethod = root.TryGetProperty("paymentMethod", out var pm) ? pm.GetString() : "vodafone_cash";
    var senderPhone = root.TryGetProperty("senderPhone", out var sp) ? sp.GetString() : "";
    var receiptUrl = root.TryGetProperty("receiptUrl", out var ru) ? ru.GetString() : "";

    using var conn = db.CreateConnection();
    var reqId = Guid.NewGuid().ToString();

    await conn.ExecuteAsync(@"
        INSERT INTO app_payment_requests (id, user_id, course_id, amount, payment_method, sender_phone, receipt_url, status, created_at)
        VALUES (@reqId::uuid, @userId::uuid, @courseId::uuid, @amount, @paymentMethod, @senderPhone, @receiptUrl, 'pending', @now);
    ", new { reqId, userId = user!.id, courseId, amount, paymentMethod, senderPhone, receiptUrl, now = DateTime.UtcNow });

    return Results.Ok(new { ok = true, message = "تم إرسال طلب الدفع بنجاح وفي انتظار مراجعة الإدارة" });
});

// ---------------------------------------------------------------------------
// 4. Admin Management Endpoints
// ---------------------------------------------------------------------------
app.MapGet("/api/admin/dashboard", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    var totalStudents = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM app_users WHERE role = 'student';");
    var totalCourses = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM app_courses;");
    var totalLessons = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM app_lessons;");
    var pendingPayments = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM app_payment_requests WHERE status = 'pending';");

    return Results.Ok(new
    {
        total_students = totalStudents,
        total_courses = totalCourses,
        total_lessons = totalLessons,
        pending_payments = pendingPayments
    });
});

app.MapGet("/api/admin/courses", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    var courses = (await conn.QueryAsync<AppCourse>("SELECT * FROM app_courses ORDER BY created_at DESC;")).AsList();
    var sections = (await conn.QueryAsync<AppSection>("SELECT * FROM app_sections ORDER BY sort_order ASC;")).AsList();
    var lessons = (await conn.QueryAsync<AppLesson>("SELECT * FROM app_lessons ORDER BY sort_order ASC;")).AsList();

    var fullCourses = courses.Select(c => new
    {
        c.id,
        c.title,
        c.description,
        c.price,
        c.thumbnail_url,
        c.is_published,
        sections = sections.Where(s => s.course_id == c.id).Select(s => new
        {
            s.id,
            s.title,
            s.sort_order,
            lessons = lessons.Where(l => l.section_id == s.id)
        })
    });

    return Results.Ok(fullCourses);
});

app.MapPost("/api/admin/courses", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var root = doc.RootElement;

    var course = new AppCourse
    {
        id = Guid.NewGuid().ToString(),
        title = root.GetProperty("title").GetString()!,
        description = root.TryGetProperty("description", out var d) ? d.GetString() : "",
        price = root.TryGetProperty("price", out var p) ? p.GetDecimal() : 0,
        thumbnail_url = root.TryGetProperty("thumbnail_url", out var t) ? t.GetString() : "",
        is_published = true,
        created_at = DateTime.UtcNow
    };

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        INSERT INTO app_courses (id, title, description, price, thumbnail_url, is_published, created_at)
        VALUES (@id::uuid, @title, @description, @price, @thumbnail_url, @is_published, @created_at);
    ", course);

    return Results.Ok(course);
});

app.MapPut("/api/admin/courses/{id}", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var root = doc.RootElement;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        UPDATE app_courses 
        SET 
            title = @title, 
            description = @description, 
            price = @price, 
            thumbnail_url = @thumbnail_url,
            is_published = @is_published
        WHERE id = @id::uuid;
    ", new
    {
        id,
        title = root.GetProperty("title").GetString()!,
        description = root.TryGetProperty("description", out var d) ? d.GetString() : "",
        price = root.TryGetProperty("price", out var p) ? p.GetDecimal() : 0,
        thumbnail_url = root.TryGetProperty("thumbnail_url", out var t) ? t.GetString() : "",
        is_published = root.TryGetProperty("is_published", out var ip) ? ip.GetBoolean() : true
    });

    return Results.Ok(new { ok = true });
});

app.MapDelete("/api/admin/courses/{id}", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync("DELETE FROM app_courses WHERE id = @id::uuid;", new { id });
    return Results.Ok(new { ok = true });
});

app.MapPost("/api/admin/sections", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var root = doc.RootElement;

    var section = new AppSection
    {
        id = Guid.NewGuid().ToString(),
        course_id = root.GetProperty("course_id").GetString()!,
        title = root.GetProperty("title").GetString()!,
        sort_order = root.TryGetProperty("sort_order", out var so) ? so.GetInt32() : 0
    };

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        INSERT INTO app_sections (id, course_id, title, sort_order)
        VALUES (@id::uuid, @course_id::uuid, @title, @sort_order);
    ", section);

    return Results.Ok(section);
});

app.MapPost("/api/admin/lessons", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var root = doc.RootElement;

    var lesson = new AppLesson
    {
        id = Guid.NewGuid().ToString(),
        course_id = root.GetProperty("course_id").GetString()!,
        section_id = root.GetProperty("section_id").GetString()!,
        title = root.GetProperty("title").GetString()!,
        description = root.TryGetProperty("description", out var d) ? d.GetString() : "",
        duration_minutes = root.TryGetProperty("duration_minutes", out var dm) ? dm.GetInt32() : 0,
        video_id = root.TryGetProperty("video_id", out var v) ? v.GetString() : "",
        sort_order = root.TryGetProperty("sort_order", out var so) ? so.GetInt32() : 0,
        is_free_preview = root.TryGetProperty("is_free_preview", out var fp) ? fp.GetBoolean() : false,
        created_at = DateTime.UtcNow
    };

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        INSERT INTO app_lessons (id, course_id, section_id, title, description, duration_minutes, video_id, sort_order, is_free_preview, created_at)
        VALUES (@id::uuid, @course_id::uuid, @section_id::uuid, @title, @description, @duration_minutes, @video_id, @sort_order, @is_free_preview, @created_at);
    ", lesson);

    return Results.Ok(lesson);
});

app.MapDelete("/api/admin/lessons/{id}", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync("DELETE FROM app_lessons WHERE id = @id::uuid;", new { id });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/admin/students", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    var students = (await conn.QueryAsync<AppUser>(
        "SELECT id, name, email, phone, role, is_banned, last_seen_at FROM app_users ORDER BY created_at DESC;")).AsList();

    var devices = (await conn.QueryAsync<AppUserDevice>("SELECT * FROM app_user_devices;")).AsList();
    var enrollments = (await conn.QueryAsync<dynamic>("SELECT user_id, course_id FROM app_enrollments;")).AsList();

    var result = students.Select(s => new
    {
        s.id,
        s.name,
        s.email,
        s.phone,
        s.role,
        s.is_banned,
        s.last_seen_at,
        devices = devices.Where(d => d.user_id == s.id).Select(d => new
        {
            d.id,
            d.device_label,
            d.platform,
            hw_short = d.device_id.Length > 8 ? d.device_id.Substring(0, 8) : d.device_id
        }),
        enrolled_course_ids = enrollments.Where(e => (string)e.user_id == s.id).Select(e => (string)e.course_id).ToList()
    });

    return Results.Ok(result);
});

app.MapPost("/api/admin/students/{id}/reset-devices", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync("DELETE FROM app_user_devices WHERE user_id = @id::uuid;", new { id });
    return Results.Ok(new { ok = true, message = "تم تصفير بصمة الأجهزة للطالب بنجاح" });
});

app.MapPost("/api/admin/students/{id}/toggle-ban", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync("UPDATE app_users SET is_banned = NOT is_banned WHERE id = @id::uuid;", new { id });
    return Results.Ok(new { ok = true });
});

app.MapPost("/api/admin/students/{id}/enroll", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var courseId = doc.RootElement.GetProperty("courseId").GetString()!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        INSERT INTO app_enrollments (id, user_id, course_id, enrolled_at)
        VALUES (@eId::uuid, @id::uuid, @courseId::uuid, @now)
        ON CONFLICT (user_id, course_id) DO NOTHING;
    ", new { eId = Guid.NewGuid().ToString(), id, courseId, now = DateTime.UtcNow });

    return Results.Ok(new { ok = true });
});

app.MapGet("/api/admin/payments", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    var payments = await conn.QueryAsync(@"
        SELECT 
            p.*, 
            u.name as student_name, 
            u.email as student_email, 
            c.title as course_title
        FROM app_payment_requests p
        JOIN app_users u ON p.user_id = u.id
        JOIN app_courses c ON p.course_id = c.id
        ORDER BY p.created_at DESC;
    ");

    return Results.Ok(payments);
});

app.MapPost("/api/admin/payments/{id}/approve", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    var pay = await conn.QueryFirstOrDefaultAsync<AppPaymentRequest>(
        "SELECT * FROM app_payment_requests WHERE id = @id::uuid;", new { id });

    if (pay == null) return Results.NotFound();

    await conn.ExecuteAsync(
        "UPDATE app_payment_requests SET status = 'approved', reviewed_at = @now WHERE id = @id::uuid;",
        new { now = DateTime.UtcNow, id });

    await conn.ExecuteAsync(@"
        INSERT INTO app_enrollments (id, user_id, course_id, enrolled_at)
        VALUES (@eId::uuid, @userId::uuid, @courseId::uuid, @now)
        ON CONFLICT (user_id, course_id) DO NOTHING;
    ", new { eId = Guid.NewGuid().ToString(), userId = pay.user_id, courseId = pay.course_id, now = DateTime.UtcNow });

    return Results.Ok(new { ok = true, message = "تمت الموافقة وتفعيل الكورس للطالب فوراً!" });
});

app.MapPost("/api/admin/payments/{id}/reject", async (string id, HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(
        "UPDATE app_payment_requests SET status = 'rejected', reviewed_at = @now WHERE id = @id::uuid;",
        new { now = DateTime.UtcNow, id });

    return Results.Ok(new { ok = true });
});

app.MapPut("/api/admin/config", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var reader = new StreamReader(ctx.Request.Body);
    var json = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(json);
    var root = doc.RootElement;

    using var conn = db.CreateConnection();
    await conn.ExecuteAsync(@"
        UPDATE app_config 
        SET 
            app_name = @app_name,
            instructor_name = @instructor_name,
            welcome_subtitle = @welcome_subtitle,
            whatsapp_number = @whatsapp_number,
            instapay_address = @instapay_address,
            wallet_number = @wallet_number,
            payment_holder_name = @payment_holder_name,
            updated_at = @now
        WHERE id = 1;
    ", new
    {
        app_name = root.TryGetProperty("app_name", out var an) ? an.GetString() : "Idea Courses",
        instructor_name = root.TryGetProperty("instructor_name", out var i) ? i.GetString() : "بشمهندس ميدو شلبي",
        welcome_subtitle = root.TryGetProperty("welcome_subtitle", out var ws) ? ws.GetString() : "",
        whatsapp_number = root.TryGetProperty("whatsapp_number", out var wn) ? wn.GetString() : "01026533835",
        instapay_address = root.TryGetProperty("instapay_address", out var ip) ? ip.GetString() : "01222752276",
        wallet_number = root.TryGetProperty("wallet_number", out var vn) ? vn.GetString() : "01026533835",
        payment_holder_name = root.TryGetProperty("payment_holder_name", out var ph) ? ph.GetString() : "محمد ا ع ي شلبي",
        now = DateTime.UtcNow
    });

    return Results.Ok(new { ok = true });
});

app.MapGet("/api/admin/youtube/connection", async (HttpContext ctx) =>
{
    if (!RequireAdmin(ctx, out _, out var err)) return err!;

    using var conn = db.CreateConnection();
    var connRow = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM app_youtube_connection LIMIT 1;");
    if (connRow != null)
    {
        return Results.Ok(new
        {
            connected = true,
            channel_title = (string)connRow.channel_title,
            channel_id = (string)connRow.channel_id
        });
    }

    return Results.Ok(new { connected = false });
});

// ---------------------------------------------------------------------------
// 5. Public Download Endpoints
// ---------------------------------------------------------------------------
app.MapGet("/api/public/desktop-download", () =>
{
    var candidates = new[]
    {
        Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../Ready-Installers/Idea-Courses-Desktop-v2.exe")),
        Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../Ready-Installers/Idea-Courses-Desktop.exe")),
        Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "Ready-Installers/Idea-Courses-Desktop-v2.exe"))
    };

    foreach (var p in candidates)
    {
        if (File.Exists(p))
        {
            return Results.File(p, "application/vnd.microsoft.portable-executable", "منصة-المحاضرات-للكمبيوتر-ويندوز.exe");
        }
    }

    return Results.NotFound(new { error = "ملف الكمبيوتر غير متوفر على السيرفر" });
});

app.MapGet("/api/public/mobile-download", () =>
{
    var candidates = new[]
    {
        Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../Ready-Installers/Idea-Courses-Mobile.apk")),
        Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "Ready-Installers/Idea-Courses-Mobile.apk"))
    };

    foreach (var p in candidates)
    {
        if (File.Exists(p))
        {
            return Results.File(p, "application/vnd.android.package-archive", "منصة-المحاضرات-للأندرويد.apk");
        }
    }

    return Results.NotFound(new { error = "ملف الأندرويد غير متوفر على السيرفر" });
});

// ---------------------------------------------------------------------------
// 6. SPA Fallback
// ---------------------------------------------------------------------------
if (!string.IsNullOrEmpty(spaDist) && Directory.Exists(spaDist))
{
    var indexPath = Path.Combine(spaDist, "index.html");
    if (File.Exists(indexPath))
    {
        app.MapFallbackToFile("index.html", new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(spaDist)
        });
    }
}

Console.WriteLine($"🚀 Edunova Platform C# ASP.NET Core Server running on port {port}...");
app.Run();
