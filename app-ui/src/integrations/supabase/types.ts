export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          course_id: string
          created_at: string
          created_by: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          course_id: string
          created_at?: string
          created_by: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          course_id?: string
          created_at?: string
          created_by?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bundle_orders: {
        Row: {
          amount: number
          course_ids: string[]
          created_at: string
          discount_percent: number
          id: string
          reviewed_at: string | null
          status: string
          subtotal: number
          transaction_ref: string
          user_id: string
        }
        Insert: {
          amount: number
          course_ids: string[]
          created_at?: string
          discount_percent?: number
          id?: string
          reviewed_at?: string | null
          status?: string
          subtotal: number
          transaction_ref: string
          user_id: string
        }
        Update: {
          amount?: number
          course_ids?: string[]
          created_at?: string
          discount_percent?: number
          id?: string
          reviewed_at?: string | null
          status?: string
          subtotal?: number
          transaction_ref?: string
          user_id?: string
        }
        Relationships: []
      }
      certificate_blocks: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          cert_code: string
          course_id: string
          course_slug: string | null
          course_title: string
          created_at: string
          id: string
          issued_at: string
          student_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cert_code: string
          course_id: string
          course_slug?: string | null
          course_title: string
          created_at?: string
          id?: string
          issued_at?: string
          student_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cert_code?: string
          course_id?: string
          course_slug?: string | null
          course_title?: string
          created_at?: string
          id?: string
          issued_at?: string
          student_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiry_date: string | null
          id: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiry_date?: string | null
          id?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expiry_date?: string | null
          id?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      course_tasks: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          is_published: boolean
          lesson_id: string | null
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_tasks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          certificate_config: Json | null
          created_at: string
          description: string
          description_en: string | null
          discount_price: number | null
          duration: string | null
          id: string
          image_url: string | null
          instructor_avatar_url: string | null
          instructor_bio: string | null
          instructor_name: string
          is_hidden: boolean
          is_latest: boolean
          level: Database["public"]["Enums"]["course_level"]
          preview_video_url: string | null
          price: number
          rating: number | null
          requirements: string[]
          short_description: string | null
          short_description_en: string | null
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          students_count: number | null
          suitable_for: string[]
          title: string
          title_en: string | null
          what_you_learn: string[] | null
          what_you_learn_en: Json | null
        }
        Insert: {
          category: string
          certificate_config?: Json | null
          created_at?: string
          description: string
          description_en?: string | null
          discount_price?: number | null
          duration?: string | null
          id?: string
          image_url?: string | null
          instructor_avatar_url?: string | null
          instructor_bio?: string | null
          instructor_name: string
          is_hidden?: boolean
          is_latest?: boolean
          level?: Database["public"]["Enums"]["course_level"]
          preview_video_url?: string | null
          price?: number
          rating?: number | null
          requirements?: string[]
          short_description?: string | null
          short_description_en?: string | null
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          students_count?: number | null
          suitable_for?: string[]
          title: string
          title_en?: string | null
          what_you_learn?: string[] | null
          what_you_learn_en?: Json | null
        }
        Update: {
          category?: string
          certificate_config?: Json | null
          created_at?: string
          description?: string
          description_en?: string | null
          discount_price?: number | null
          duration?: string | null
          id?: string
          image_url?: string | null
          instructor_avatar_url?: string | null
          instructor_bio?: string | null
          instructor_name?: string
          is_hidden?: boolean
          is_latest?: boolean
          level?: Database["public"]["Enums"]["course_level"]
          preview_video_url?: string | null
          price?: number
          rating?: number | null
          requirements?: string[]
          short_description?: string | null
          short_description_en?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          students_count?: number | null
          suitable_for?: string[]
          title?: string
          title_en?: string | null
          what_you_learn?: string[] | null
          what_you_learn_en?: Json | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completed_lessons: string[] | null
          course_id: string
          created_at: string
          id: string
          progress: number
          status: string
          user_id: string
        }
        Insert: {
          completed_lessons?: string[] | null
          course_id: string
          created_at?: string
          id?: string
          progress?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_lessons?: string[] | null
          course_id?: string
          created_at?: string
          id?: string
          progress?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_published: boolean
          order_index: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_published?: boolean
          order_index?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_published?: boolean
          order_index?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_videos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      lesson_access_blocks: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          lesson_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_access_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completion_count: number
          course_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          last_position_seconds: number
          last_watched_at: string
          lesson_id: string
          updated_at: string
          user_id: string
          watched_seconds: number
        }
        Insert: {
          completion_count?: number
          course_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_position_seconds?: number
          last_watched_at?: string
          lesson_id: string
          updated_at?: string
          user_id: string
          watched_seconds?: number
        }
        Update: {
          completion_count?: number
          course_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_position_seconds?: number
          last_watched_at?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
          watched_seconds?: number
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: string | null
          created_at: string
          duration: string | null
          id: string
          is_preview: boolean
          module_id: string
          order_index: number
          title: string
          title_en: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          is_preview?: boolean
          module_id: string
          order_index?: number
          title: string
          title_en?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          is_preview?: boolean
          module_id?: string
          order_index?: number
          title?: string
          title_en?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          allowed_user_ids: string[]
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          google_event_id: string | null
          id: string
          last_sync_attempt_at: string | null
          meeting_url: string | null
          module_id: string | null
          provider: string | null
          recording_synced_at: string | null
          recording_url: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
          zoom_meeting_id: string | null
        }
        Insert: {
          allowed_user_ids?: string[]
          course_id: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          last_sync_attempt_at?: string | null
          meeting_url?: string | null
          module_id?: string | null
          provider?: string | null
          recording_synced_at?: string | null
          recording_url?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
          zoom_meeting_id?: string | null
        }
        Update: {
          allowed_user_ids?: string[]
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          last_sync_attempt_at?: string | null
          meeting_url?: string | null
          module_id?: string | null
          provider?: string | null
          recording_synced_at?: string | null
          recording_url?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
          zoom_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_resources: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          module_id: string
          notes: string | null
          order_index: number
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          module_id: string
          notes?: string | null
          order_index?: number
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          module_id?: string
          notes?: string | null
          order_index?: number
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number
          title: string
          title_en: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
          title_en?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string
          email_batch_id: string | null
          id: string
          link: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          email_batch_id?: string | null
          id?: string
          link?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          email_batch_id?: string | null
          id?: string
          link?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          coupon_code: string | null
          course_id: string
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_screenshot_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          transaction_ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          coupon_code?: string | null
          course_id: string
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_screenshot_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          coupon_code?: string | null
          course_id?: string
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_screenshot_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_failures: {
        Row: {
          attempt_count: number
          course_id: string | null
          created_at: string
          error_code: string | null
          error_message: string
          event_payload: Json
          id: string
          last_attempted_at: string
          max_attempts: number
          next_retry_at: string
          provider: string
          resolution_note: string | null
          resolved_at: string | null
          signature_header: string | null
          transaction_ref: string | null
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          course_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message: string
          event_payload: Json
          id?: string
          last_attempted_at?: string
          max_attempts?: number
          next_retry_at?: string
          provider?: string
          resolution_note?: string | null
          resolved_at?: string | null
          signature_header?: string | null
          transaction_ref?: string | null
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          course_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string
          event_payload?: Json
          id?: string
          last_attempted_at?: string
          max_attempts?: number
          next_retry_at?: string
          provider?: string
          resolution_note?: string | null
          resolved_at?: string | null
          signature_header?: string | null
          transaction_ref?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          created_at: string
          current_path: string | null
          device_warning_at: string | null
          email: string
          id: string
          last_active_at: string | null
          name: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          current_path?: string | null
          device_warning_at?: string | null
          email: string
          id: string
          last_active_at?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          current_path?: string | null
          device_warning_at?: string | null
          email?: string
          id?: string
          last_active_at?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          comment: string | null
          course_id: string
          created_at: string
          id: string
          image_url: string | null
          is_approved: boolean
          rating: number
          user_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean
          rating: number
          user_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          joined_at: string | null
          left_at: string | null
          matched_email: string | null
          notified_at: string | null
          session_id: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          joined_at?: string | null
          left_at?: string | null
          matched_email?: string | null
          notified_at?: string | null
          session_id: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          joined_at?: string | null
          left_at?: string | null
          matched_email?: string | null
          notified_at?: string | null
          session_id?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_works: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          is_published: boolean
          order_index: number
          student_name: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_published?: boolean
          order_index?: number
          student_name?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_published?: boolean
          order_index?: number
          student_name?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      success_stories: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          id: string
          image_url: string
          is_published: boolean
          order_index: number
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          id?: string
          image_url: string
          is_published?: boolean
          order_index?: number
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string
          is_published?: boolean
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          created_at: string
          id: string
          last_message_at: string
          status: string
          user_id: string | null
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string | null
          visitor_session_id: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          user_id?: string | null
          visitor_email?: string | null
          visitor_name: string
          visitor_phone?: string | null
          visitor_session_id: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          user_id?: string | null
          visitor_email?: string | null
          visitor_name?: string
          visitor_phone?: string | null
          visitor_session_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_role: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          grade: number | null
          id: string
          is_late: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["task_submission_status"]
          task_id: string
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          is_late?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["task_submission_status"]
          task_id: string
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          is_late?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["task_submission_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "course_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          device_id: string
          first_seen: string
          id: string
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_id: string
          first_seen?: string
          id?: string
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_id?: string
          first_seen?: string
          id?: string
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events_processed: {
        Row: {
          course_id: string | null
          event_id: string
          id: string
          processed_at: string
          provider: string
          transaction_ref: string | null
          user_id: string | null
        }
        Insert: {
          course_id?: string | null
          event_id: string
          id?: string
          processed_at?: string
          provider: string
          transaction_ref?: string | null
          user_id?: string | null
        }
        Update: {
          course_id?: string | null
          event_id?: string
          id?: string
          processed_at?: string
          provider?: string
          transaction_ref?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      zoom_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          meeting_id: string | null
          payload: Json | null
          recording_url: string | null
          session_id: string | null
          signature_valid: boolean | null
          sync_ok: boolean | null
          sync_reason: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          meeting_id?: string | null
          payload?: Json | null
          recording_url?: string | null
          session_id?: string | null
          signature_valid?: boolean | null
          sync_ok?: boolean | null
          sync_reason?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          meeting_id?: string | null
          payload?: Json | null
          recording_url?: string | null
          session_id?: string | null
          signature_valid?: boolean | null
          sync_ok?: boolean | null
          sync_reason?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_course_lesson_progress: {
        Args: { _course_id: string }
        Returns: {
          completion_count: number
          duration_seconds: number
          last_position_seconds: number
          last_watched_at: string
          lesson_id: string
          lesson_title: string
          module_title: string
          user_email: string
          user_id: string
          user_name: string
          watched_seconds: number
        }[]
      }
      admin_list_active_users: {
        Args: { _minutes?: number }
        Returns: {
          avatar_url: string
          current_path: string
          email: string
          is_admin: boolean
          is_moderator: boolean
          last_active_at: string
          name: string
          user_id: string
        }[]
      }
      admin_reset_user_devices: {
        Args: { _user_id: string }
        Returns: undefined
      }
      attendance_settings: { Args: never; Returns: Json }
      certificate_eligibility: {
        Args: { _course_id: string; _user_id: string }
        Returns: Json
      }
      claim_first_admin: { Args: never; Returns: boolean }
      course_attendance_rate: {
        Args: { _course_id: string; _user_id: string }
        Returns: {
          attended_sessions: number
          rate: number
          total_sessions: number
        }[]
      }
      delete_old_chat_messages: { Args: { _days: number }; Returns: number }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_course_outline: {
        Args: { _course_id: string }
        Returns: {
          is_preview: boolean
          lesson_duration: string
          lesson_id: string
          lesson_order: number
          lesson_title: string
          lesson_title_en: string
          module_id: string
          module_order: number
          module_title: string
          module_title_en: string
        }[]
      }
      get_courses_lesson_stats: {
        Args: never
        Returns: {
          course_id: string
          lessons_count: number
          total_seconds: number
        }[]
      }
      get_courses_ratings: {
        Args: never
        Returns: {
          avg_rating: number
          course_id: string
          ratings_count: number
        }[]
      }
      get_max_devices: { Args: never; Returns: number }
      get_preview_lesson_video: {
        Args: { _lesson_id: string }
        Returns: {
          title: string
          video_url: string
        }[]
      }
      get_profile_directory: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          id: string
          name: string
        }[]
      }
      get_public_reviews: {
        Args: { _course_id?: string; _limit?: number }
        Returns: {
          author_avatar_url: string
          author_name: string
          comment: string
          course_id: string
          created_at: string
          id: string
          image_url: string
          is_approved: boolean
          is_own: boolean
          rating: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      issue_certificate: {
        Args: {
          _course_id: string
          _course_slug: string
          _course_title: string
          _student_name: string
        }
        Returns: {
          cert_code: string
          issued_at: string
        }[]
      }
      list_admins: {
        Args: never
        Returns: {
          email: string
          name: string
          user_id: string
        }[]
      }
      list_users_last_signin: {
        Args: never
        Returns: {
          last_sign_in_at: string
          user_id: string
        }[]
      }
      mark_lesson_complete: { Args: { _lesson_id: string }; Returns: Json }
      my_certificate_eligibility: {
        Args: { _course_id: string }
        Returns: Json
      }
      my_course_attendance: {
        Args: { _course_id: string }
        Returns: {
          duration_minutes: number
          joined_at: string
          scheduled_at: string
          session_id: string
          status: string
          title: string
          watched_recording: boolean
        }[]
      }
      no_admin_exists: { Args: never; Returns: boolean }
      preview_access_code: { Args: { _code: string }; Returns: Json }
      redeem_access_code: { Args: { _code: string }; Returns: Json }
      register_device: {
        Args: { _device_id: string; _user_agent: string }
        Returns: Json
      }
      set_enrollment_banned: {
        Args: { _banned: boolean; _course_id: string; _user_id: string }
        Returns: undefined
      }
      set_max_devices: { Args: { _max: number }; Returns: undefined }
      set_user_banned: {
        Args: { _banned: boolean; _user_id: string }
        Returns: undefined
      }
      support_get_state: {
        Args: { _conv_id: string; _session_id: string }
        Returns: Json
      }
      support_insert_bot_message: {
        Args: { _content: string; _conv_id: string; _session_id: string }
        Returns: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      support_request_human: {
        Args: { _conv_id: string; _session_id: string }
        Returns: undefined
      }
      support_send_visitor_message: {
        Args: {
          _attachment_name: string
          _attachment_type: string
          _attachment_url: string
          _content: string
          _conv_id: string
          _session_id: string
        }
        Returns: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }
        SetofOptions: {
          from: "*"
          to: "support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      support_start_conversation: {
        Args: {
          _email: string
          _name: string
          _phone: string
          _session_id: string
          _user_id: string
        }
        Returns: {
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          created_at: string
          id: string
          last_message_at: string
          status: string
          user_id: string | null
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string | null
          visitor_session_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      touch_last_active:
        | { Args: never; Returns: undefined }
        | { Args: { _path?: string }; Returns: undefined }
      upsert_lesson_progress: {
        Args: {
          _completed: boolean
          _delta_watched: number
          _duration: number
          _lesson_id: string
          _position: number
        }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string }
        Returns: {
          active: boolean
          code: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiry_date: string
          id: string
          usage_count: number
          usage_limit: number
        }[]
      }
      verify_certificate: {
        Args: { _code: string }
        Returns: {
          cert_code: string
          course_slug: string
          course_title: string
          issued_at: string
          student_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "student" | "moderator"
      course_level: "beginner" | "intermediate" | "advanced"
      course_status: "draft" | "published"
      discount_type: "percentage" | "fixed"
      order_status: "pending" | "approved" | "rejected"
      payment_method: "vodafone_cash" | "instapay" | "bank_transfer"
      task_submission_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student", "moderator"],
      course_level: ["beginner", "intermediate", "advanced"],
      course_status: ["draft", "published"],
      discount_type: ["percentage", "fixed"],
      order_status: ["pending", "approved", "rejected"],
      payment_method: ["vodafone_cash", "instapay", "bank_transfer"],
      task_submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
