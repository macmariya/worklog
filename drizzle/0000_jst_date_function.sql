-- JST の日付を返す。time_entries.entry_date（生成列）と CHECK time_entries_same_jst_day が使う。
-- IMMUTABLE と宣言するのは「日本のタイムゾーン定義（UTC+9・夏時間なし）は今後変わらない」という前提を
-- このアプリが引き受けるため。変わったら entry_date を作り直す必要がある（03_データ設計 §3）。
-- 2026-10-20 実測: PostgreSQL 18.6 では timezone(text, timestamptz) 自体が IMMUTABLE で、
-- 生成列に AT TIME ZONE を直書きしても通った。定義を 1 か所にまとめるためにラッパーを残す。
CREATE FUNCTION jst_date(ts timestamptz) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT (ts AT TIME ZONE 'Asia/Tokyo')::date $$;
