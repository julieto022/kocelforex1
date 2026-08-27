#ifndef KOCEL_HTTP_MQH
#define KOCEL_HTTP_MQH

#include "../Core/KocelConstants.mqh"
#include "../Core/KocelTypes.mqh"

class CKocelHttp
{
private:
   string m_base_url;
   int m_timeout_seconds;
   string m_last_error;

   string NormalizePath(const string path) const
   {
      if(path == "")
         return "";
      if(StringSubstr(path, 0, 1) == "/")
         return path;
      return "/" + path;
   }

public:
   CKocelHttp()
   {
      m_base_url = "";
      m_timeout_seconds = KOCEL_DEFAULT_TIMEOUT_SECONDS;
      m_last_error = "";
   }

   void Configure(const string base_url, const int timeout_seconds)
   {
      m_base_url = base_url;
      m_timeout_seconds = timeout_seconds;
      m_last_error = "";
   }

   string BuildUrl(const string path) const
   {
      return m_base_url + NormalizePath(path);
   }

   string BuildHeaders(const string bearer_token = "") const
   {
      string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
      if(bearer_token != "")
         headers += "Authorization: Bearer " + bearer_token + "\r\n";
      return headers;
   }

   string UserSafeHttpError(const KocelHttpResponse &response) const
   {
      if(response.permission_required)
         return "Kocel API access is not allowed by MT5. Add the Kocel API URL to Tools > Options > Expert Advisors > Allow WebRequest for listed URL.";

      if(!response.transport_executed)
         return "Unable to reach Kocel server.";

      switch(response.status_code)
      {
         case 400:
         case 422: return "Kocel rejected the request as invalid.";
         case 401: return "Kocel session is invalid or expired.";
         case 403: return "Kocel rejected the Bridge request.";
         case 404: return "Kocel Bridge endpoint was not found.";
         case 409: return "Kocel authorization request is no longer available.";
         case 429: return "Kocel rate limit reached. Please wait before retrying.";
         case 500:
         case 502:
         case 503:
         case 504: return "Kocel server is temporarily unavailable.";
      }

      if(response.status_code > 0)
         return "Unexpected Kocel HTTP status: " + IntegerToString(response.status_code) + ".";
      return "Unable to reach Kocel server.";
   }

   bool IsRetryable(const KocelHttpResponse &response) const
   {
      if(response.permission_required)
         return false;
      if(!response.transport_executed)
         return true;
      return response.status_code == 429 || response.status_code == 500 || response.status_code == 502 || response.status_code == 503 || response.status_code == 504;
   }

   bool Send(const string method, const string path, const string payload, const string bearer_token, KocelHttpResponse &response)
   {
      KocelResetHttpResponse(response);

      char request_data[];
      if(payload != "")
         StringToCharArray(payload, request_data, 0, StringLen(payload), CP_UTF8);
      else
         ArrayResize(request_data, 0);

      char result_data[];
      string result_headers = "";
      const string url = BuildUrl(path);

      ResetLastError();
      const int status_code = WebRequest(method, url, BuildHeaders(bearer_token), m_timeout_seconds * 1000, request_data, result_data, result_headers);

      response.status_code = status_code;
      response.headers = result_headers;
      response.transport_executed = status_code != -1;
      response.body = CharArrayToString(result_data, 0, ArraySize(result_data), CP_UTF8);

      if(status_code == -1)
      {
         response.mql_error = GetLastError();
         response.permission_required = response.mql_error == 4014;
         response.error_message = UserSafeHttpError(response);
         m_last_error = response.error_message;
         return false;
      }

      if(!IsSuccessStatus(response))
      {
         response.error_message = UserSafeHttpError(response);
         m_last_error = response.error_message;
         return false;
      }

      m_last_error = "";
      return true;
   }

   bool HttpGet(const string path, const string bearer_token, KocelHttpResponse &response)
   {
      return Send("GET", path, "", bearer_token, response);
   }

   bool HttpPost(const string path, const string payload, const string bearer_token, KocelHttpResponse &response)
   {
      return Send("POST", path, payload, bearer_token, response);
   }

   bool IsSuccessStatus(const KocelHttpResponse &response) const
   {
      return response.status_code >= 200 && response.status_code < 300;
   }

   string LastError() const
   {
      return m_last_error;
   }

   int TimeoutSeconds() const
   {
      return m_timeout_seconds;
   }
};

#endif
