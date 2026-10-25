const fs = require('fs');
const path = require('path');
const android = path.join(process.cwd(), 'android');
const manifestPath = path.join(android, 'app/src/main/AndroidManifest.xml');
const javaDir = path.join(android, 'app/src/main/java/com/speakwise/englishcoach');
const activityPath = path.join(javaDir, 'MainActivity.java');
const servicePath = path.join(javaDir, 'FloatingButtonService.java');
if (!fs.existsSync(manifestPath) || !fs.existsSync(activityPath)) throw new Error('Capacitor Android project files not found.');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.RECORD_AUDIO',
  'android.permission.INTERNET'
];
for (const p of permissions) if (!manifest.includes(p)) manifest = manifest.replace('<application', `    <uses-permission android:name="${p}" />\n    <application`);
if (!manifest.includes('android.speech.RecognitionService')) manifest = manifest.replace('</manifest>', '    <queries><intent><action android:name="android.speech.RecognitionService" /></intent></queries>\n</manifest>');
if (!manifest.includes('FloatingButtonService')) manifest = manifest.replace('</application>', '        <service android:name=".FloatingButtonService" android:exported="false" android:foregroundServiceType="microphone" />\n    </application>');
fs.writeFileSync(manifestPath, manifest);
let activity = fs.readFileSync(activityPath, 'utf8');
if (!activity.includes('ensureFloatingButtonPermission')) {
  activity = activity.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport android.content.Intent;\nimport android.net.Uri;\nimport android.provider.Settings;\nimport android.os.Build;\nimport android.Manifest;\nimport android.content.pm.PackageManager;\nimport androidx.core.app.ActivityCompat;');
  activity = activity.replace('public class MainActivity extends BridgeActivity {}', `public class MainActivity extends BridgeActivity {
    private static final int OVERLAY_PERMISSION_REQUEST = 6421;
    private static final int AUDIO_PERMISSION_REQUEST = 6422;
    @Override public void onCreate(android.os.Bundle savedInstanceState) { super.onCreate(savedInstanceState); ensurePermissions(); }
    private void ensurePermissions() {
      if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST); return;
      }
      ensureFloatingButtonPermission();
    }
    private void ensureFloatingButtonPermission() {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
        startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())), OVERLAY_PERMISSION_REQUEST);
      } else startFloatingButton();
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
      super.onRequestPermissionsResult(requestCode, permissions, grantResults);
      if (requestCode == AUDIO_PERMISSION_REQUEST && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) ensureFloatingButtonPermission();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
      super.onActivityResult(requestCode, resultCode, data);
      if (requestCode == OVERLAY_PERMISSION_REQUEST && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this))) startFloatingButton();
    }
    private void startFloatingButton() {
      Intent i = new Intent(this, FloatingButtonService.class);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(i); else startService(i);
    }
  }`);
  fs.writeFileSync(activityPath, activity);
}
const service = `package com.speakwise.englishcoach;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class FloatingButtonService extends Service {
  // Set this to your deployed Cloudflare Worker URL. Keep the Gemini API key in Worker secrets, never here.
  private static final String CORRECTION_URL = "https://speakwise-correct.siranjith0506.workers.dev/";
  private WindowManager wm; private View bubble; private WindowManager.LayoutParams bubbleParams;
  private View panel; private EditText spoken; private TextView status, corrected; private SpeechRecognizer recognizer;
  private final Handler main = new Handler(Looper.getMainLooper()); private boolean listening = false;
  @Override public void onCreate() { super.onCreate(); startNotice(); showBubble(); }
  private void startNotice() {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationManager nm = getSystemService(NotificationManager.class);
      nm.createNotificationChannel(new NotificationChannel("speakwise", "SpeakWise floating assistant", NotificationManager.IMPORTANCE_LOW));
      Notification n = new Notification.Builder(this, "speakwise").setContentTitle("SpeakWise is ready").setContentText("Tap the floating S button to dictate and correct English").setSmallIcon(android.R.drawable.ic_btn_speak_now).build();
      startForeground(1001, n);
    }
  }
  private GradientDrawable rounded(int color) { GradientDrawable d=new GradientDrawable(); d.setColor(color); d.setCornerRadius(24); return d; }
  private TextView text(String s, int size, int color) { TextView t=new TextView(this); t.setText(s); t.setTextSize(size); t.setTextColor(color); t.setPadding(12,8,12,8); return t; }
  private Button button(String s) { Button b=new Button(this); b.setText(s); return b; }
  private void showBubble() {
    wm=(WindowManager)getSystemService(WINDOW_SERVICE); TextView b=text("S",21,Color.WHITE); b.setGravity(Gravity.CENTER); b.setTypeface(null,Typeface.BOLD); b.setBackground(rounded(Color.rgb(23,107,85)));
    int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE;
    bubbleParams=new WindowManager.LayoutParams(58,58,type,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT); bubbleParams.gravity=Gravity.TOP|Gravity.END; bubbleParams.x=12; bubbleParams.y=250;
    b.setOnTouchListener(new View.OnTouchListener(){int sx,sy;float dx,dy;boolean moved;public boolean onTouch(View v,MotionEvent e){if(e.getAction()==0){sx=bubbleParams.x;sy=bubbleParams.y;dx=e.getRawX();dy=e.getRawY();moved=false;return true;}if(e.getAction()==2){int x=(int)(e.getRawX()-dx),y=(int)(e.getRawY()-dy);if(Math.abs(x)>8||Math.abs(y)>8)moved=true;bubbleParams.x=Math.max(0,sx-x);bubbleParams.y=Math.max(0,sy+y);wm.updateViewLayout(bubble,bubbleParams);return true;}if(e.getAction()==1){if(!moved)showPanel();return true;}return true;}});
    bubble=b; wm.addView(bubble,bubbleParams);
  }
  private void showPanel() {
    if(panel!=null){try{wm.removeView(panel);}catch(Exception ignored){} panel=null;}
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(14,12,14,12);root.setBackground(rounded(Color.WHITE));
    TextView heading=text("SpeakWise • Speak & Correct",18,Color.rgb(23,107,85));heading.setTypeface(null,Typeface.BOLD);root.addView(heading);
    status=text("Tap Speak and talk in English. No translation.",13,Color.DKGRAY);root.addView(status);
    spoken=new EditText(this);spoken.setHint("Your spoken words will appear here…");spoken.setMinLines(2);spoken.setGravity(Gravity.TOP);root.addView(spoken,new LinearLayout.LayoutParams(-1,-2));
    LinearLayout actions=new LinearLayout(this);actions.setOrientation(LinearLayout.HORIZONTAL);
    Button mic=button("🎙 Speak");Button stop=button("Stop");Button fix=button("Correct English");actions.addView(mic,new LinearLayout.LayoutParams(0,-2,1));actions.addView(stop,new LinearLayout.LayoutParams(0,-2,1));actions.addView(fix,new LinearLayout.LayoutParams(0,-2,1));root.addView(actions);
    TextView label=text("Corrected English",14,Color.DKGRAY);label.setTypeface(null,Typeface.BOLD);root.addView(label);
    corrected=text("Your corrected text will appear here.",15,Color.BLACK);corrected.setPadding(12,12,12,12);corrected.setBackground(rounded(0xFFF0F5F3));root.addView(corrected);
    LinearLayout bottom=new LinearLayout(this);Button copy=button("Copy text");Button close=button("Close");bottom.addView(copy,new LinearLayout.LayoutParams(0,-2,1));bottom.addView(close,new LinearLayout.LayoutParams(0,-2,1));root.addView(bottom);
    ScrollView scroll=new ScrollView(this);scroll.addView(root);
    int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE;
    WindowManager.LayoutParams p=new WindowManager.LayoutParams(-1,Math.min((int)(getResources().getDisplayMetrics().heightPixels*0.82),1000),type,WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);p.gravity=Gravity.CENTER;
    panel=scroll;wm.addView(panel,p);
    mic.setOnClickListener(v->startListening());stop.setOnClickListener(v->stopListening());fix.setOnClickListener(v->correctText());
    copy.setOnClickListener(v->{String value=corrected.getText().toString();if(value.startsWith("Your corrected")||value.startsWith("Correction failed")||value.startsWith("Set your")){value=spoken.getText().toString();}((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("SpeakWise corrected text",value));Toast.makeText(this,"Copied. Paste it into your message.",Toast.LENGTH_SHORT).show();});
    close.setOnClickListener(v->{stopListening();if(panel!=null){wm.removeView(panel);panel=null;}});
  }
  private void startListening(){
    if(!SpeechRecognizer.isRecognitionAvailable(this)){status.setText("Speech recognition isn't available on this phone.");return;}
    try{if(recognizer!=null)recognizer.destroy();recognizer=SpeechRecognizer.createSpeechRecognizer(this);recognizer.setRecognitionListener(new RecognitionListener(){public void onReadyForSpeech(android.os.Bundle b){main.post(()->status.setText("Listening… speak now."));}public void onBeginningOfSpeech(){}public void onRmsChanged(float f){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){main.post(()->status.setText("Processing speech…"));}public void onError(int e){main.post(()->{listening=false;status.setText("Couldn't hear that clearly. Tap Speak to try again.");});}public void onResults(android.os.Bundle b){main.post(()->{listening=false;java.util.ArrayList<String> r=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(r!=null&&!r.isEmpty()){spoken.setText(r.get(0));status.setText("Speech captured. Tap Correct English.");}});}public void onPartialResults(android.os.Bundle b){}public void onEvent(int a,android.os.Bundle b){}});
      Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ta-IN");i.putExtra(RecognizerIntent.EXTRA_PROMPT,"Speak naturally in Tamil. SpeakWise will convert it to Tanglish.");i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false);listening=true;recognizer.startListening(i);
    }catch(Exception ex){status.setText("Unable to start microphone: "+ex.getMessage());}
  }
  private void stopListening(){if(recognizer!=null&&listening){try{recognizer.stopListening();}catch(Exception ignored){}listening=false;}}
  private void correctText(){String input=spoken.getText().toString().trim();if(input.isEmpty()){status.setText("Speak or type a message first.");return;}if(CORRECTION_URL.contains("YOUR-WORKER-NAME")){corrected.setText("Set your Cloudflare Worker URL in scripts/patch-android.js, then rebuild the APK.");status.setText("AI correction isn't connected yet.");return;}status.setText("Correcting English…");new Thread(()->{HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(CORRECTION_URL).openConnection();c.setRequestMethod("POST");c.setConnectTimeout(15000);c.setReadTimeout(25000);c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json; charset=utf-8");JSONObject body=new JSONObject();body.put("text",input);try(OutputStream os=c.getOutputStream()){os.write(body.toString().getBytes(StandardCharsets.UTF_8));}int code=c.getResponseCode();BufferedReader br=new BufferedReader(new InputStreamReader(code<400?c.getInputStream():c.getErrorStream(),StandardCharsets.UTF_8));StringBuilder sb=new StringBuilder();String line;while((line=br.readLine())!=null)sb.append(line);JSONObject result=new JSONObject(sb.toString());String output=result.optString("correctedText","");if(code>=400||output.isEmpty())throw new Exception(result.optString("error","AI service error (HTTP "+code+")"));main.post(()->{corrected.setText(output);status.setText("Done — corrected English, not translated.");});}catch(Exception ex){main.post(()->{corrected.setText("Correction failed: "+ex.getMessage());status.setText("Check internet connection and AI service setup.");});}finally{if(c!=null)c.disconnect();}}).start();}
  @Override public int onStartCommand(Intent i,int flags,int id){return START_STICKY;}
  @Override public void onDestroy(){stopListening();if(recognizer!=null)recognizer.destroy();try{if(panel!=null)wm.removeView(panel);if(bubble!=null)wm.removeView(bubble);}catch(Exception ignored){}super.onDestroy();}
  @Override public IBinder onBind(Intent i){return null;}
}`;
fs.writeFileSync(servicePath, service);
console.log('Configured SpeakWise native overlay with speech recognition, popup, copy, and AI endpoint placeholder.');
