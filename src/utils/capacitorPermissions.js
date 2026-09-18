import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

/**
 * تابع انتخاب تصویر (مانند لوگو) از گالری / دوربین با مدیریت مجوز در زمان اجرا (Runtime Permissions)
 * 1. بدون درخواست مجوز در زمان اجرای اولیه برنامه
 * 2. ابتدا Camera.checkPermissions() بررسی می‌شود
 * 3. در صورت عدم تایید، Camera.requestPermissions() فراخوانی می‌شود
 * 4. در صورت رد مجوز (Deny)، پیام "برای انجام این کار به مجوز نیاز است" به کاربر نمایش داده می‌شود
 *
 * @param {Function} notifyError - تابع نمایش پیام خطا (مثلاً toast یا alert)
 * @returns {Promise<string|null>} - رشته dataUrl تصویر یا null در صورت لغو/عدم مجوز
 */
export async function pickImageWithCapacitorPermission(notifyError) {
  const showErr = (msg) => {
    if (typeof notifyError === "function") {
      notifyError(msg);
    } else {
      alert(msg);
    }
  };

  try {
    if (Capacitor.isNativePlatform()) {
      // ۱. بررسی مجوزهای فعلی
      const checkPerm = await Camera.checkPermissions();

      const isGranted =
        checkPerm.camera === "granted" || checkPerm.photos === "granted";

      if (!isGranted) {
        // ۲. درخواست مجوز در صورت عدم دسترسی
        const reqPerm = await Camera.requestPermissions({
          permissions: ["camera", "photos"],
        });

        const isReqGranted =
          reqPerm.camera === "granted" || reqPerm.photos === "granted";

        if (!isReqGranted) {
          showErr("برای انجام این کار به مجوز نیاز است");
          return null;
        }
      }

      // ۳. باز کردن گالری/دوربین جهت انتخاب عکس
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      return image.dataUrl || null;
    }
  } catch (error) {
    console.warn("Capacitor Camera Permission Error:", error);
    // اگر کاربر درخواست مجوز را رد کند یا پنجره را ببندد
    if (
      error?.message?.toLowerCase().includes("denied") ||
      error?.message?.toLowerCase().includes("permission") ||
      error?.message?.includes("User cancelled")
    ) {
      if (
        error?.message?.toLowerCase().includes("denied") ||
        error?.message?.toLowerCase().includes("permission")
      ) {
        showErr("برای انجام این کار به مجوز نیاز است");
      }
      return null;
    }
  }

  return null;
}

/**
 * تابع ذخیره فایل در پوشه Documents با مدیریت مجوز در زمان اجرا (Runtime Permissions)
 * 1. بدون درخواست مجوز در زمان لود اولیه برنامه
 * 2. ابتدا Filesystem.checkPermissions() بررسی می‌شود
 * 3. در صورت عدم تایید، Filesystem.requestPermissions() فراخوانی می‌شود
 * 4. در صورت رد مجوز (Deny)، پیام "برای انجام این کار به مجوز نیاز است" به کاربر نمایش داده می‌شود
 * 5. ذخیره فایل در پوشه Documents
 *
 * @param {string} fileName - نام فایل (مثلاً invoice_101.png)
 * @param {string} base64OrDataUrl - داده تصویر به صورت base64 یا DataURL
 * @param {Function} notifyError - تابع نمایش پیام خطا یا موفقیت
 * @returns {Promise<boolean>} - نتیجه عملیات
 */
export async function saveFileWithCapacitorPermission(
  fileName,
  base64OrDataUrl,
  notifyError
) {
  const showErr = (msg) => {
    if (typeof notifyError === "function") {
      notifyError(msg);
    } else {
      alert(msg);
    }
  };

  try {
    if (Capacitor.isNativePlatform()) {
      // ۱. بررسی مجوز دسترسی به فایل‌ها
      const checkPerm = await Filesystem.checkPermissions();

      if (checkPerm.publicStorage !== "granted") {
        // ۲. درخواست مجوز
        const reqPerm = await Filesystem.requestPermissions();
        if (reqPerm.publicStorage !== "granted") {
          showErr("برای انجام این کار به مجوز نیاز است");
          return false;
        }
      }

      // ۳. پاکسازی رشته Base64
      const cleanBase64 = base64OrDataUrl.includes(",")
        ? base64OrDataUrl.split(",")[1]
        : base64OrDataUrl;

      // ۴. ذخیره فایل در پوشه Documents
      await Filesystem.writeFile({
        path: fileName,
        data: cleanBase64,
        directory: Directory.Documents,
        recursive: true,
      });

      return true;
    }
  } catch (error) {
    console.warn("Capacitor Filesystem Permission Error:", error);
    if (
      error?.message?.toLowerCase().includes("denied") ||
      error?.message?.toLowerCase().includes("permission")
    ) {
      showErr("برای انجام این کار به مجوز نیاز است");
    } else {
      showErr("خطا در ذخیره‌سازی فایل در پوشه Documents");
    }
    return false;
  }

  return false;
}

import { Share } from '@capacitor/share';

export async function shareFileWithCapacitorPermission(fileName, base64OrDataUrl, notifyError) {
  try {
    if (Capacitor.isNativePlatform()) {
      const cleanBase64 = base64OrDataUrl.includes(",")
        ? base64OrDataUrl.split(",")[1]
        : base64OrDataUrl;
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: cleanBase64,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        url: writeResult.uri,
        title: 'اشتراک‌گذاری',
      });
      return true;
    }
  } catch (error) {
    console.warn("Capacitor Share Error:", error);
    if (typeof notifyError === "function") {
      notifyError("خطا در اشتراک‌گذاری");
    }
  }
  return false;
}
