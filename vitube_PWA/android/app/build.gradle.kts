import java.util.Properties

plugins {
    id("com.android.application")
}

/*
  Địa chỉ vitube mà app sẽ mở. Truyền khi build:
      ./gradlew assembleRelease -PvitubeUrl=https://vitube.example.com
  (script build-apk.sh lo việc này)
*/
val vitubeUrl: String = (project.findProperty("vitubeUrl") as String?)?.trimEnd('/')
    ?: "https://example.invalid"
val vitubeHost: String = java.net.URI(vitubeUrl).host ?: "example.invalid"

// Chứng chỉ ký: build-apk.sh tự tạo và ghi vào keystore.properties (không đưa lên git)
val keyProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "app.vitube.pwa"
    compileSdk = 35

    defaultConfig {
        applicationId = (project.findProperty("vitubePackage") as String?) ?: "app.vitube.pwa"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        resValue("string", "launch_url", "$vitubeUrl/?source=twa")
        resValue("string", "host_name", vitubeHost)
        // "tên miền này thuộc về app này" — phải khớp với /.well-known/assetlinks.json phía server
        resValue(
            "string", "asset_statements",
            """[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"https://$vitubeHost"}}]"""
        )
    }

    signingConfigs {
        create("release") {
            if (keyProps.isNotEmpty()) {
                storeFile = rootProject.file(keyProps.getProperty("storeFile"))
                storePassword = keyProps.getProperty("storePassword")
                keyAlias = keyProps.getProperty("keyAlias")
                keyPassword = keyProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keyProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Thư viện chính thức của Google cho Trusted Web Activity
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
