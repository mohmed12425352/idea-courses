using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Dapper;
using EdunovaPlatform.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace EdunovaPlatform.Api.Services
{
    public class AuthService
    {
        private readonly DatabaseService _db;
        private readonly string _jwtSecret;
        private readonly string _issuer;
        private readonly string _audience;

        public AuthService(DatabaseService db, IConfiguration config)
        {
            _db = db;
            _jwtSecret = config["Jwt:Secret"] ?? "edunova-csharp-prod-jwt-secret-9f8e7d6c5b4a3210-medo-shalaby-2026";
            _issuer = config["Jwt:Issuer"] ?? "EdunovaPlatform";
            _audience = config["Jwt:Audience"] ?? "EdunovaUsers";
        }

        public string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        public bool VerifyPassword(string password, string hash)
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, hash);
            }
            catch
            {
                return false;
            }
        }

        public string GenerateToken(AppUser user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtSecret);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.id),
                new Claim(ClaimTypes.Name, user.name),
                new Claim(ClaimTypes.Email, user.email),
                new Claim(ClaimTypes.Role, user.role)
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddDays(30),
                Issuer = _issuer,
                Audience = _audience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public ClaimsPrincipal? ValidateToken(string token)
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.UTF8.GetBytes(_jwtSecret);

                var parameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                };

                return tokenHandler.ValidateToken(token, parameters, out _);
            }
            catch
            {
                return null;
            }
        }

        public async Task<string?> VerifyOrBindDeviceAsync(string userId, string role, string deviceId, string userAgent)
        {
            if (role == "admin") return null;
            if (string.IsNullOrWhiteSpace(deviceId)) return null;

            using var conn = _db.CreateConnection();
            await conn.OpenAsync();

            var config = await conn.QueryFirstOrDefaultAsync<AppConfig>("SELECT max_devices FROM app_config LIMIT 1;");
            int maxDevices = config?.max_devices ?? 1;

            var existingDevices = (await conn.QueryAsync<AppUserDevice>(
                "SELECT * FROM app_user_devices WHERE user_id = @userId::uuid ORDER BY last_active_at DESC;",
                new { userId })).AsList();

            var match = existingDevices.Find(d => d.device_id == deviceId);
            if (match != null)
            {
                await conn.ExecuteAsync(
                    "UPDATE app_user_devices SET last_active_at = @now WHERE id = @id::uuid;",
                    new { now = DateTime.UtcNow, id = match.id });
                return null;
            }

            if (existingDevices.Count < maxDevices)
            {
                string platform = "web";
                string label = "متصفح الويب";
                string ua = (userAgent ?? "").ToLower();
                if (ua.Contains("android")) { platform = "mobile"; label = "هاتف أندرويد"; }
                else if (ua.Contains("iphone") || ua.Contains("ipad")) { platform = "mobile"; label = "هاتف آيفون"; }
                else if (ua.Contains("windows")) { platform = "desktop"; label = "كمبيوتر ويندوز"; }
                else if (ua.Contains("mac")) { platform = "desktop"; label = "جهاز ماك"; }

                await conn.ExecuteAsync(@"
                    INSERT INTO app_user_devices (id, user_id, device_id, device_label, platform, hw_fingerprint, last_active_at)
                    VALUES (@id::uuid, @userId::uuid, @deviceId, @label, @platform, @deviceId, @now);
                ", new
                {
                    id = Guid.NewGuid().ToString(),
                    userId,
                    deviceId,
                    label,
                    platform,
                    now = DateTime.UtcNow
                });
                return null;
            }

            return $"هذا الحساب مربوط بالفعل بجهاز آخر ({existingDevices[0].device_label}). يُرجى استخدام نفس الجهاز أو التواصل مع الإدارة لإعادة تعيين الجهاز.";
        }
    }
}
