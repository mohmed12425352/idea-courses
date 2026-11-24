using System;
using System.Collections.Generic;

namespace EdunovaPlatform.Api.Models
{
    public class AppUser
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string name { get; set; } = string.Empty;
        public string email { get; set; } = string.Empty;
        public string password_hash { get; set; } = string.Empty;
        public string role { get; set; } = "student"; // "admin" | "student"
        public string? phone { get; set; }
        public bool is_banned { get; set; } = false;
        public DateTime? last_seen_at { get; set; }
        public string? last_platform { get; set; }
        public DateTime created_at { get; set; } = DateTime.UtcNow;
    }

    public class AppConfig
    {
        public int id { get; set; } = 1;
        public string app_name { get; set; } = "Idea Courses";
        public string instructor_name { get; set; } = "بشمهندس ميدو شلبي";
        public string welcome_subtitle { get; set; } = "منصة المحاضرات التفاعلية المحمية للكمبيوتر والموبايل";
        public string whatsapp_number { get; set; } = "01026533835";
        public string instapay_address { get; set; } = "01222752276";
        public string wallet_number { get; set; } = "01026533835";
        public string payment_holder_name { get; set; } = "محمد ا ع ي شلبي";
        public int max_devices { get; set; } = 1;
        public bool desktop_mobile_only { get; set; } = false;
        public DateTime updated_at { get; set; } = DateTime.UtcNow;
    }

    public class AppCourse
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string title { get; set; } = string.Empty;
        public string? description { get; set; }
        public decimal price { get; set; } = 0;
        public string? thumbnail_url { get; set; }
        public bool is_published { get; set; } = true;
        public DateTime created_at { get; set; } = DateTime.UtcNow;
    }

    public class AppSection
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string course_id { get; set; } = string.Empty;
        public string title { get; set; } = string.Empty;
        public int sort_order { get; set; } = 0;
    }

    public class AppLesson
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string section_id { get; set; } = string.Empty;
        public string course_id { get; set; } = string.Empty;
        public string title { get; set; } = string.Empty;
        public string? description { get; set; }
        public int duration_minutes { get; set; } = 0;
        public string? video_id { get; set; }
        public int sort_order { get; set; } = 0;
        public bool is_free_preview { get; set; } = false;
        public DateTime created_at { get; set; } = DateTime.UtcNow;
    }

    public class AppUserDevice
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string user_id { get; set; } = string.Empty;
        public string device_id { get; set; } = string.Empty;
        public string device_label { get; set; } = string.Empty;
        public string platform { get; set; } = "unknown";
        public string? hw_fingerprint { get; set; }
        public DateTime last_active_at { get; set; } = DateTime.UtcNow;
    }

    public class AppPaymentRequest
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string user_id { get; set; } = string.Empty;
        public string course_id { get; set; } = string.Empty;
        public decimal amount { get; set; } = 0;
        public string payment_method { get; set; } = "vodafone_cash"; // "vodafone_cash" | "instapay"
        public string? sender_phone { get; set; }
        public string? receipt_url { get; set; }
        public string status { get; set; } = "pending"; // "pending" | "approved" | "rejected"
        public string? notes { get; set; }
        public DateTime created_at { get; set; } = DateTime.UtcNow;
        public DateTime? reviewed_at { get; set; }
    }

    public class AppActivationCode
    {
        public string id { get; set; } = Guid.NewGuid().ToString();
        public string code { get; set; } = string.Empty;
        public string course_id { get; set; } = string.Empty;
        public bool is_used { get; set; } = false;
        public string? used_by_user_id { get; set; }
        public DateTime created_at { get; set; } = DateTime.UtcNow;
        public DateTime? used_at { get; set; }
    }
}
