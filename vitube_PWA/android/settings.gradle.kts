pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

/*
  App Android "bọc web" cho vitube (Trusted Web Activity).

  Không có dòng giao diện nào ở đây: toàn bộ app là trang vitube mở trong Chrome ở
  chế độ toàn màn hình. Nhờ vậy sửa giao diện web là app tự cập nhật theo — không
  phải build lại hay gửi lại APK.
*/
rootProject.name = "vitube-pwa"
include(":app")
