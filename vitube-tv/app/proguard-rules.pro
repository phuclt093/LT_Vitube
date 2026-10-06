# kotlinx.serialization giữ lại metadata của các lớp @Serializable
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.vitube.tv.data.** { *; }
-keep,includedescriptorclasses class com.vitube.tv.data.**$$serializer { *; }
