# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.aalsitrader.android.model.**$$serializer { *; }
-keepclassmembers class com.aalsitrader.android.model.** {
    *** Companion;
}
-keepclasseswithmembers class com.aalsitrader.android.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.aalsitrader.android.network.**$$serializer { *; }
-keepclassmembers class com.aalsitrader.android.network.** {
    *** Companion;
}
-keepclasseswithmembers class com.aalsitrader.android.network.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit
-keepattributes Signature, Exceptions, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations, AnnotationDefault

# Keep Retrofit API interfaces fully — R8 strips generic signatures from suspend
# function Continuation<T> params, causing ParameterizedType cast failures
-keep interface com.aalsitrader.android.network.** { *; }

# Keep all @Serializable data classes used as Retrofit request/response types
-keep @kotlinx.serialization.Serializable class com.aalsitrader.android.network.** { *; }
-keep @kotlinx.serialization.Serializable class com.aalsitrader.android.model.** { *; }

# Keep Continuation generic signature for suspend function return type resolution
-keep class kotlin.coroutines.Continuation { *; }

-keep,allowobfuscation,allowshrinking class retrofit2.Response

-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Tink (via security-crypto) - suppress R8 missing class warnings
-dontwarn com.google.errorprone.annotations.CanIgnoreReturnValue
-dontwarn com.google.errorprone.annotations.CheckReturnValue
-dontwarn com.google.errorprone.annotations.Immutable
-dontwarn com.google.errorprone.annotations.RestrictedApi
