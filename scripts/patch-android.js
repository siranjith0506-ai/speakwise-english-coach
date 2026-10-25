const fs = require('fs');
const path = require('path');

const android = path.join(process.cwd(), 'android');
const manifestPath = path.join(android, 'app/src/main/AndroidManifest.xml');
const javaDir = path.join(android, 'app/src/main/java/com/speakwise/englishcoach');
const activityPath = path.join(javaDir, 'MainActivity.java');
const servicePath = path.join(javaDir, 'FloatingButtonService.java');

if (!fs.existsSync(manifestPath) || !fs.existsSync(activityPath)) {
  throw new Error('Capacitor Android project files were not found.');
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
  manifest = manifest.replace('<application',
    '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n    <application');
}
if (!manifest.includes('FloatingButtonService')) {
  manifest = manifest.replace('</application>',
    '        <service android:name=".FloatingButtonService" android:exported="false" />\n    </application>');
}
fs.writeFileSync(manifestPath, manifest);

let activity = fs.readFileSync(activityPath, 'utf8');
if (!activity.includes('ensureFloatingButtonPermission')) {
  activity = activity.replace(
    'import com.getcapacitor.BridgeActivity;',
    'import com.getcapacitor.BridgeActivity;\nimport android.content.Intent;\nimport android.net.Uri;\nimport android.provider.Settings;\nimport android.os.Build;'
  );
  activity = activity.replace(
    'public class MainActivity extends BridgeActivity {}',
    `public class MainActivity extends BridgeActivity {
      private static final int OVERLAY_PERMISSION_REQUEST = 6421;
      @Override public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureFloatingButtonPermission();
      }
      private void ensureFloatingButtonPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
          Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
          startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST);
        } else { startFloatingButton(); }
      }
      @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OVERLAY_PERMISSION_REQUEST &&
            (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this))) {
          startFloatingButton();
        }
      }
      private void startFloatingButton() {
        Intent service = new Intent(this, FloatingButtonService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
        else startService(service);
      }
    }`
  );
  fs.writeFileSync(activityPath, activity);
}

let service = fs.readFileSync(servicePath, 'utf8');
if (!service.includes('import android.view.View;')) {
  service = service.replace('import android.view.Gravity;', 'import android.view.Gravity;\nimport android.view.View;');
  fs.writeFileSync(servicePath, service);
}

console.log('Added SpeakWise floating overlay service.');
