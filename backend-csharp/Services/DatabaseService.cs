using System;
using System.Data;
using System.Threading.Tasks;
using Dapper;
using EdunovaPlatform.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace EdunovaPlatform.Api.Services
{
    public class GuidToStringHandler : SqlMapper.TypeHandler<string>
    {
        public override void SetValue(IDbDataParameter parameter, string? value)
        {
            if (Guid.TryParse(value, out var g))
            {
                parameter.Value = g;
            }
            else
            {
                parameter.Value = DBNull.Value;
            }
        }

        public override string Parse(object value)
        {
            return value?.ToString() ?? string.Empty;
        }
    }

    public class DatabaseService
    {
        private readonly string _connectionString;
        private readonly ILogger<DatabaseService> _logger;

        static DatabaseService()
        {
            SqlMapper.AddTypeHandler(new GuidToStringHandler());
        }

        public DatabaseService(IConfiguration config, ILogger<DatabaseService> logger)
        {
            var raw = config.GetConnectionString("DefaultConnection") 
                ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? "Host=ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_Yeu12bSqwCBF;SSL Mode=Require;";

            _connectionString = ConvertUrlToNpgsqlConnectionString(raw);
            _logger = logger;
        }

        private static string ConvertUrlToNpgsqlConnectionString(string connStr)
        {
            if (string.IsNullOrWhiteSpace(connStr)) return connStr;
            if (!connStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) &&
                !connStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
            {
                return connStr;
            }

            try
            {
                var uri = new Uri(connStr);
                var userInfo = uri.UserInfo.Split(':');
                var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
                var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
                var host = uri.Host;
                var port = uri.Port > 0 ? uri.Port : 5432;
                var database = uri.AbsolutePath.TrimStart('/');

                var builder = new NpgsqlConnectionStringBuilder
                {
                    Host = host,
                    Port = port,
                    Database = string.IsNullOrEmpty(database) ? "neondb" : database,
                    Username = username,
                    Password = password,
                    SslMode = SslMode.Require
                };

                return builder.ConnectionString;
            }
            catch
            {
                return connStr;
            }
        }

        public NpgsqlConnection CreateConnection()
        {
            return new NpgsqlConnection(_connectionString);
        }

        public async Task InitializeAsync()
        {
            try
            {
                using var conn = CreateConnection();
                await conn.OpenAsync();
                _logger.LogInformation("Connected successfully to Neon PostgreSQL database.");

                // Ensure admin user exists
                var admin = await conn.QueryFirstOrDefaultAsync<AppUser>(
                    "SELECT id, email, role FROM app_users WHERE role = 'admin' LIMIT 1;");

                if (admin == null)
                {
                    _logger.LogInformation("Seeding default Admin user...");
                    var adminHash = BCrypt.Net.BCrypt.HashPassword("Admin@123456");
                    await conn.ExecuteAsync(@"
                        INSERT INTO app_users (id, name, email, password_hash, role, phone, is_banned)
                        VALUES (
                            '5bcd3c54-f2ee-4f64-ad84-cff2e2a1048e',
                            'بشمهندس ميدو شلبي (Admin)',
                            'admin@edunova.eg',
                            @adminHash,
                            'admin',
                            '01026533835',
                            false
                        )
                        ON CONFLICT (email) DO UPDATE 
                        SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = 'admin';
                    ", new { adminHash });
                }

                // Ensure app_config exists and has proper branding
                var config = await conn.QueryFirstOrDefaultAsync<AppConfig>("SELECT id, app_name FROM app_config LIMIT 1;");
                if (config == null)
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO app_config (id, app_name, instructor_name, welcome_subtitle, whatsapp_number, instapay_address, wallet_number, payment_holder_name)
                        VALUES (1, 'Idea Courses', 'بشمهندس ميدو شلبي', 'منصة المحاضرات التفاعلية المحمية للكمبيوتر والموبايل', '01026533835', '01222752276', '01026533835', 'محمد ا ع ي شلبي');
                    ");
                }
                else
                {
                    await conn.ExecuteAsync(@"
                        UPDATE app_config 
                        SET 
                            instructor_name = 'بشمهندس ميدو شلبي',
                            payment_holder_name = 'محمد ا ع ي شلبي'
                        WHERE id = 1;
                    ");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Database initialization warning: {Message}", ex.Message);
            }
        }
    }
}
