#ifndef KOCEL_CONTROLS_MQH
#define KOCEL_CONTROLS_MQH

#include "../Core/KocelConstants.mqh"

class CKocelControls
{
public:
   bool CreatePanelBox(const long chart_id, const string name, const ENUM_BASE_CORNER corner, const int x, const int y, const int width, const int height, const color background, const color border)
   {
      if(!ObjectCreate(chart_id, name, OBJ_RECTANGLE_LABEL, 0, 0, 0))
         return false;

      ObjectSetInteger(chart_id, name, OBJPROP_CORNER, corner);
      ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(chart_id, name, OBJPROP_XSIZE, width);
      ObjectSetInteger(chart_id, name, OBJPROP_YSIZE, height);
      ObjectSetInteger(chart_id, name, OBJPROP_BGCOLOR, background);
      ObjectSetInteger(chart_id, name, OBJPROP_COLOR, border);
      ObjectSetInteger(chart_id, name, OBJPROP_BACK, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTED, false);
      ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
      return true;
   }

   bool CreateLabel(const long chart_id, const string name, const ENUM_BASE_CORNER corner, const int x, const int y, const string text, const int font_size, const color text_color)
   {
      if(!ObjectCreate(chart_id, name, OBJ_LABEL, 0, 0, 0))
         return false;

      ObjectSetInteger(chart_id, name, OBJPROP_CORNER, corner);
      ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, y);
      ObjectSetString(chart_id, name, OBJPROP_TEXT, text);
      ObjectSetString(chart_id, name, OBJPROP_FONT, KOCEL_UI_FONT);
      ObjectSetInteger(chart_id, name, OBJPROP_FONTSIZE, font_size);
      ObjectSetInteger(chart_id, name, OBJPROP_COLOR, text_color);
      ObjectSetInteger(chart_id, name, OBJPROP_BACK, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTED, false);
      ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
      return true;
   }

   bool CreateButton(const long chart_id, const string name, const ENUM_BASE_CORNER corner, const int x, const int y, const int width, const int height, const string text, const color background, const color text_color)
   {
      if(!ObjectCreate(chart_id, name, OBJ_BUTTON, 0, 0, 0))
         return false;

      ObjectSetInteger(chart_id, name, OBJPROP_CORNER, corner);
      ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(chart_id, name, OBJPROP_XSIZE, width);
      ObjectSetInteger(chart_id, name, OBJPROP_YSIZE, height);
      ObjectSetString(chart_id, name, OBJPROP_TEXT, text);
      ObjectSetString(chart_id, name, OBJPROP_FONT, KOCEL_UI_FONT);
      ObjectSetInteger(chart_id, name, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(chart_id, name, OBJPROP_BGCOLOR, background);
      ObjectSetInteger(chart_id, name, OBJPROP_COLOR, text_color);
      ObjectSetInteger(chart_id, name, OBJPROP_COLOR, text_color);
      ObjectSetInteger(chart_id, name, OBJPROP_BACK, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTED, false);
      ObjectSetInteger(chart_id, name, OBJPROP_STATE, false);
      ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
      return true;
   }
};

#endif
