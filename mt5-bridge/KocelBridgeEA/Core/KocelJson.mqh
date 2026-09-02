#ifndef KOCEL_JSON_MQH
#define KOCEL_JSON_MQH

string KocelJsonEscape(const string raw)
{
   string escaped = "";
   for(int i = 0; i < StringLen(raw); i++)
   {
      const ushort ch = StringGetCharacter(raw, i);
      if(ch == '"')
         escaped += "\\\"";
      else if(ch == '\\')
         escaped += "\\\\";
      else if(ch == '\r')
         escaped += "\\r";
      else if(ch == '\n')
         escaped += "\\n";
      else if(ch == '\t')
         escaped += "\\t";
      else
         escaped += ShortToString(ch);
   }
   return escaped;
}

string KocelJsonString(const string value)
{
   return "\"" + KocelJsonEscape(value) + "\"";
}

string KocelJsonStringOrNull(const string value)
{
   if(value == "")
      return "null";
   return KocelJsonString(value);
}

string KocelJsonUnescape(string value)
{
   StringReplace(value, "\\\"", "\"");
   StringReplace(value, "\\/", "/");
   StringReplace(value, "\\\\", "\\");
   StringReplace(value, "\\r", "\r");
   StringReplace(value, "\\n", "\n");
   StringReplace(value, "\\t", "\t");
   return value;
}

int KocelJsonFindValueStart(const string json, const string key)
{
   const string needle = "\"" + key + "\"";
   const int key_pos = StringFind(json, needle);
   if(key_pos < 0)
      return -1;

   const int colon_pos = StringFind(json, ":", key_pos + StringLen(needle));
   if(colon_pos < 0)
      return -1;

   int pos = colon_pos + 1;
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if(ch != ' ' && ch != '\r' && ch != '\n' && ch != '\t')
         return pos;
      pos++;
   }
   return -1;
}

bool KocelJsonGetString(const string json, const string key, string &value)
{
   value = "";
   int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0 || StringGetCharacter(json, pos) != '"')
      return false;

   pos++;
   string raw = "";
   bool escaped = false;
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if(escaped)
      {
         raw += "\\" + ShortToString(ch);
         escaped = false;
      }
      else if(ch == '\\')
      {
         escaped = true;
      }
      else if(ch == '"')
      {
         value = KocelJsonUnescape(raw);
         return true;
      }
      else
      {
         raw += ShortToString(ch);
      }
      pos++;
   }
   return false;
}

bool KocelJsonGetBool(const string json, const string key, bool &value)
{
   value = false;
   const int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0)
      return false;

   const string tail = StringSubstr(json, pos, 5);
   if(StringFind(tail, "true") == 0)
   {
      value = true;
      return true;
   }

   if(StringFind(tail, "false") == 0)
   {
      value = false;
      return true;
   }
   return false;
}

bool KocelJsonGetInt(const string json, const string key, int &value)
{
   value = 0;
   int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0)
      return false;

   string raw = "";
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '-')
         raw += ShortToString(ch);
      else
         break;
      pos++;
   }

   if(raw == "" || raw == "-")
      return false;

   value = (int)StringToInteger(raw);
   return true;
}

bool KocelJsonGetObject(const string json, const string key, string &value)
{
   value = "";
   int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0 || StringGetCharacter(json, pos) != '{')
      return false;

   int depth = 0;
   bool in_string = false;
   bool escaped = false;
   const int start = pos;
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if(in_string)
      {
         if(escaped)
            escaped = false;
         else if(ch == '\\')
            escaped = true;
         else if(ch == '"')
            in_string = false;
      }
      else
      {
         if(ch == '"')
            in_string = true;
         else if(ch == '{')
            depth++;
         else if(ch == '}')
         {
            depth--;
            if(depth == 0)
            {
               value = StringSubstr(json, start, pos - start + 1);
               return true;
            }
         }
      }
      pos++;
   }
   return false;
}

datetime KocelIsoUtcToTime(const string iso_value)
{
   if(StringLen(iso_value) < 19)
      return 0;

   MqlDateTime parts;
   parts.year = (int)StringToInteger(StringSubstr(iso_value, 0, 4));
   parts.mon = (int)StringToInteger(StringSubstr(iso_value, 5, 2));
   parts.day = (int)StringToInteger(StringSubstr(iso_value, 8, 2));
   parts.hour = (int)StringToInteger(StringSubstr(iso_value, 11, 2));
   parts.min = (int)StringToInteger(StringSubstr(iso_value, 14, 2));
   parts.sec = (int)StringToInteger(StringSubstr(iso_value, 17, 2));

   if(parts.year <= 1970 || parts.mon < 1 || parts.mon > 12 || parts.day < 1 || parts.day > 31)
      return 0;

   const datetime local_assumed = StructToTime(parts);
   const long local_offset = (long)(TimeLocal() - TimeGMT());
   return (datetime)(local_assumed - local_offset);
}

bool KocelJsonGetDouble(const string json, const string key, double &value)
{
   value = 0.0;
   int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0)
      return false;

   string raw = "";
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '-' || ch == '+' || ch == '.' || ch == 'e' || ch == 'E')
         raw += ShortToString(ch);
      else
         break;
      pos++;
   }

   if(raw == "" || raw == "-" || raw == "+")
      return false;

   value = StringToDouble(raw);
   return true;
}

bool KocelJsonGetLong(const string json, const string key, long &value)
{
   value = 0;
   int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0)
      return false;

   string raw = "";
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '-')
         raw += ShortToString(ch);
      else
         break;
      pos++;
   }

   if(raw == "" || raw == "-")
      return false;

   value = StringToInteger(raw);
   return true;
}

// Extracts a raw JSON array (including brackets) for the given key.
bool KocelJsonGetArray(const string json, const string key, string &value)
{
   value = "";
   int pos = KocelJsonFindValueStart(json, key);
   if(pos < 0 || StringGetCharacter(json, pos) != '[')
      return false;

   int depth = 0;
   bool in_string = false;
   bool escaped = false;
   const int start = pos;
   while(pos < StringLen(json))
   {
      const ushort ch = StringGetCharacter(json, pos);
      if(in_string)
      {
         if(escaped)
            escaped = false;
         else if(ch == '\\')
            escaped = true;
         else if(ch == '"')
            in_string = false;
      }
      else
      {
         if(ch == '"')
            in_string = true;
         else if(ch == '[')
            depth++;
         else if(ch == ']')
         {
            depth--;
            if(depth == 0)
            {
               value = StringSubstr(json, start, pos - start + 1);
               return true;
            }
         }
      }
      pos++;
   }
   return false;
}

// Splits a JSON array of objects into its top-level object elements.
int KocelJsonSplitObjects(const string json_array, string &items[])
{
   ArrayFree(items);
   int count = 0;
   int depth = 0;
   int start = -1;
   bool in_string = false;
   bool escaped = false;

   for(int pos = 0; pos < StringLen(json_array); pos++)
   {
      const ushort ch = StringGetCharacter(json_array, pos);
      if(in_string)
      {
         if(escaped)
            escaped = false;
         else if(ch == '\\')
            escaped = true;
         else if(ch == '"')
            in_string = false;
         continue;
      }

      if(ch == '"')
      {
         in_string = true;
      }
      else if(ch == '{')
      {
         if(depth == 0)
            start = pos;
         depth++;
      }
      else if(ch == '}')
      {
         depth--;
         if(depth == 0 && start >= 0)
         {
            count++;
            ArrayResize(items, count);
            items[count - 1] = StringSubstr(json_array, start, pos - start + 1);
            start = -1;
         }
      }
   }
   return count;
}

#endif
