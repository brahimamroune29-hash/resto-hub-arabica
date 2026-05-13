import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const ar = {
  translation: {
    nav: {
      orders: "الطلبات", menu: "المنيو", tables: "الطاولات",
      analytics: "التحليلات", reviews: "التقييمات", settings: "الإعدادات",
      dashboard: "لوحة التحكم", logout: "تسجيل الخروج", account: "حسابي",
      myRestaurant: "مطعمي", ops: "إدارة العمليات",
      sub: {
        orders: "إدارة جميع الطلبات الحالية", menu: "إدارة الأصناف والفئات",
        tables: "الطاولات وأكواد QR", analytics: "أداء المطعم والإيرادات",
        reviews: "آراء وملاحظات الزبائن", settings: "إعدادات المطعم والحساب",
        ops: "المخزون، الموردين، الموظفين والهدر",
      },
    },
    common: {
      save: "حفظ", cancel: "إلغاء", delete: "حذف", edit: "تعديل", add: "إضافة",
      loading: "جاري التحميل...", saving: "جاري الحفظ...",
      yes: "نعم", no: "لا", confirm: "تأكيد", language: "اللغة",
      back: "رجوع", backHome: "العودة للرئيسية", close: "إغلاق", retry: "إعادة المحاولة",
      loadMore: "تحميل المزيد", search: "بحث", optional: "اختياري", required: "مطلوب",
      enterPin: "أدخل رمز PIN", login: "دخول", loggingIn: "جاري الدخول...",
      welcome: "مرحباً بك", error: "حدث خطأ، حاول مرة أخرى", invalidLink: "الرابط غير صحيح",
      restaurantNotFound: "مطعم غير موجود", wrongPin: "رمز خاطئ",
      table: "طاولة", noComment: "بدون تعليق",
    },
    theme: { light: "الوضع الفاتح", dark: "الوضع الداكن", enableLight: "تفعيل الوضع الفاتح", enableDark: "تفعيل الوضع الداكن" },
    notFound: { title: "الصفحة غير موجودة", desc: "ربما هذه الطاولة ليست في مطعمنا" },
    seo: { title: "نظام إدارة المطاعم الذكي", desc: "كل ما يحتاجه مطعمك في مكان واحد", tagline: "نظام إدارة المطاعم الذكي" },
    auth: {
      loginTitle: "تسجيل الدخول", loginSubtitle: "ادخل لإدارة مطعمك",
      signupTitle: "إنشاء حساب جديد", signupSubtitle: "ابدأ بإدارة مطعمك خلال دقائق",
      noAccount: "ما عندكش حساب؟", haveAccount: "عندك حساب؟",
      createAccount: "إنشاء حساب جديد", login: "تسجيل الدخول",
      email: "البريد الإلكتروني", password: "كلمة المرور",
      passwordHint: "6 أحرف على الأقل",
      creating: "جاري الإنشاء...", create: "إنشاء حساب",
      signedUp: "تم إنشاء الحساب. يرجى تأكيد بريدك الإلكتروني ثم تسجيل الدخول.",
    },
    setup: {
      title: "إعداد المطعم", subtitle: "أدخل المعلومات الأساسية للبدء",
      restaurantName: "اسم المطعم", placeholderName: "مثلاً: مطعم الأصالة",
      logo: "شعار المطعم (اختياري)", logoPreview: "معاينة الشعار", chooseLogo: "اضغط لاختيار صورة الشعار",
      googleLink: "رابط تقييم Google Maps", googleHint: "يمكنك الحصول على الرابط من Google My Business",
      start: "ابدأ", savingData: "جاري الحفظ...",
      nameRequired: "اسم المطعم مطلوب", invalidGoogle: "رابط Google Maps غير صالح",
      saved: "تم حفظ بيانات المطعم", saveFailed: "تعذّر حفظ البيانات، حاول مرة أخرى",
      duplicate: "لديك مطعم مسجل بالفعل", expired: "الجلسة منتهية، سجّل دخولك من جديد",
    },
    kitchen: { title: "دخول المطبخ", disabled: "نظام المطبخ غير مفعّل لهذا المطعم.", enableHint: "على صاحب المطعم تفعيله من الإعدادات." },
    cashier: { title: "دخول الكاشير", disabled: "نظام الكاشير غير مفعّل لهذا المطعم بعد.", enableHint: "على صاحب المطعم تفعيله من الإعدادات وتحديد رمز PIN.", readyOrders: "الطلبات الجاهزة للدفع", autoAppear: "ستظهر الطلبات تلقائياً عند جاهزيتها" },
    orders: {
      title: "الطلبات", new: "جديد", preparing: "قيد التحضير", ready: "جاهز", paid: "مدفوع",
      empty: "لا توجد طلبات", noOrdersIn: "لا توجد طلبات",
      newOrder: "طلب جديد!", table: "طاولة",
      startPreparing: "بدء التحضير", markReady: "جاهز", markPaid: "تم الدفع",
      enableSound: "تفعيل الصوت", soundOn: "الصوت مفعّل",
      loadFailed: "تعذّر تحميل الطلبات", updateFailed: "تعذّر تحديث الحالة",
    },
    tables: {
      addTable: "إضافة طاولة", emptyHint: "ابدأ بإضافة طاولة جديدة",
      tableNumber: "رقم الطاولة", deleteTable: "حذف الطاولة",
      mustBeGtZero: "رقم الطاولة يجب أن يكون أكبر من 0",
      alreadyUsed: "رقم الطاولة مستعمل بالفعل", addFailed: "تعذّر إضافة الطاولة",
      added: "تمت إضافة الطاولة", deleteFailed: "تعذّر الحذف", deleted: "تم حذف الطاولة",
      loadFailed: "تعذّر تحميل الطاولات",
      confirmDelete: "هل أنت متأكد من حذف هذه الطاولة؟",
      downloadQr: "تحميل QR", qrFailed: "تعذّر تحميل الـ QR",
      confirmDeleteWithNumber: "هل أنت متأكد من حذف الطاولة رقم {{n}}؟ لا يمكن التراجع.",
    },
    reviews: {
      avg: "متوسط التقييم", count: "عدد التقييمات",
      googleRate: "معدل التحويل لـ Google", googleHint: "تقييم إيجابي تم توجيهه لـ Google",
      all: "الكل", positive: "إيجابية (4-5⭐)", negative: "سلبية (1-3⭐)",
      empty: "لا توجد تقييمات بعد",
      sentToGoogle: "تم توجيهه لـ Google", internalOnly: "داخلي فقط",
      newPositive: "تقييم إيجابي جديد ⭐", newNegative: "تقييم سلبي - يحتاج اهتمامك",
      loadFailed: "فشل تحميل التقييمات",
    },
  },
};

const en = {
  translation: {
    nav: {
      orders: "Orders", menu: "Menu", tables: "Tables",
      analytics: "Analytics", reviews: "Reviews", settings: "Settings",
      dashboard: "Dashboard", logout: "Logout", account: "Account",
      myRestaurant: "My restaurant", ops: "Operations",
      sub: {
        orders: "Manage all current orders", menu: "Manage items and categories",
        tables: "Tables and QR codes", analytics: "Restaurant performance and revenue",
        reviews: "Customer reviews and feedback", settings: "Restaurant and account settings",
        ops: "Inventory, suppliers, staff and waste",
      },
    },
    common: {
      save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add",
      loading: "Loading...", saving: "Saving...",
      yes: "Yes", no: "No", confirm: "Confirm", language: "Language",
      back: "Back", backHome: "Back to home", close: "Close", retry: "Retry",
      loadMore: "Load more", search: "Search", optional: "optional", required: "required",
      enterPin: "Enter PIN code", login: "Login", loggingIn: "Logging in...",
      welcome: "Welcome", error: "Something went wrong, please try again", invalidLink: "Invalid link",
      restaurantNotFound: "Restaurant not found", wrongPin: "Wrong code",
      table: "Table", noComment: "No comment",
    },
    theme: { light: "Light mode", dark: "Dark mode", enableLight: "Enable light mode", enableDark: "Enable dark mode" },
    notFound: { title: "Page not found", desc: "Maybe this table is not in our restaurant" },
    seo: { title: "Smart restaurant management", desc: "Everything your restaurant needs in one place", tagline: "Smart restaurant management" },
    auth: {
      loginTitle: "Login", loginSubtitle: "Sign in to manage your restaurant",
      signupTitle: "Create new account", signupSubtitle: "Start managing your restaurant in minutes",
      noAccount: "Don't have an account?", haveAccount: "Already have an account?",
      createAccount: "Create new account", login: "Login",
      email: "Email", password: "Password", passwordHint: "At least 6 characters",
      creating: "Creating...", create: "Create account",
      signedUp: "Account created. Please confirm your email then sign in.",
    },
    setup: {
      title: "Restaurant setup", subtitle: "Enter the basic info to get started",
      restaurantName: "Restaurant name", placeholderName: "e.g. Al Asala Restaurant",
      logo: "Restaurant logo (optional)", logoPreview: "Logo preview", chooseLogo: "Click to choose a logo image",
      googleLink: "Google Maps review link", googleHint: "You can get the link from Google My Business",
      start: "Start", savingData: "Saving...",
      nameRequired: "Restaurant name is required", invalidGoogle: "Invalid Google Maps link",
      saved: "Restaurant info saved", saveFailed: "Failed to save, please try again",
      duplicate: "You already have a registered restaurant", expired: "Session expired, please log in again",
    },
    kitchen: { title: "Kitchen login", disabled: "Kitchen system is not enabled for this restaurant.", enableHint: "The restaurant owner needs to enable it from settings." },
    cashier: { title: "Cashier login", disabled: "Cashier system is not enabled yet.", enableHint: "The owner must enable it in settings and set a PIN.", readyOrders: "Orders ready for payment", autoAppear: "Orders will appear automatically when ready" },
    orders: {
      title: "Orders", new: "New", preparing: "Preparing", ready: "Ready", paid: "Paid",
      empty: "No orders", noOrdersIn: "No orders in",
      newOrder: "New order!", table: "Table",
      startPreparing: "Start preparing", markReady: "Ready", markPaid: "Paid",
      enableSound: "Enable sound", soundOn: "Sound on",
      loadFailed: "Failed to load orders", updateFailed: "Failed to update status",
    },
    tables: {
      addTable: "Add table", emptyHint: "Start by adding a new table",
      tableNumber: "Table number", deleteTable: "Delete table",
      mustBeGtZero: "Table number must be greater than 0",
      alreadyUsed: "Table number already used", addFailed: "Failed to add table",
      added: "Table added", deleteFailed: "Failed to delete", deleted: "Table deleted",
      loadFailed: "Failed to load tables",
      confirmDelete: "Are you sure you want to delete this table?",
      downloadQr: "Download QR", qrFailed: "Failed to download QR",
      confirmDeleteWithNumber: "Delete table #{{n}}? This cannot be undone.",
    },
    reviews: {
      avg: "Average rating", count: "Review count",
      googleRate: "Google conversion rate", googleHint: "positive reviews sent to Google",
      all: "All", positive: "Positive (4-5⭐)", negative: "Negative (1-3⭐)",
      empty: "No reviews yet",
      sentToGoogle: "Sent to Google", internalOnly: "Internal only",
      newPositive: "New positive review ⭐", newNegative: "Negative review — needs attention",
      loadFailed: "Failed to load reviews",
    },
  },
};

const fr = {
  translation: {
    nav: {
      orders: "Commandes", menu: "Menu", tables: "Tables",
      analytics: "Analytique", reviews: "Avis", settings: "Paramètres",
      dashboard: "Tableau de bord", logout: "Déconnexion", account: "Compte",
      myRestaurant: "Mon restaurant", ops: "Opérations",
      sub: {
        orders: "Gérer toutes les commandes en cours", menu: "Gérer les articles et catégories",
        tables: "Tables et codes QR", analytics: "Performance et revenus du restaurant",
        reviews: "Avis et commentaires des clients", settings: "Paramètres du restaurant et du compte",
        ops: "Stock, fournisseurs, personnel et gaspillage",
      },
    },
    common: {
      save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", edit: "Modifier", add: "Ajouter",
      loading: "Chargement...", saving: "Enregistrement...",
      yes: "Oui", no: "Non", confirm: "Confirmer", language: "Langue",
      back: "Retour", backHome: "Retour à l'accueil", close: "Fermer", retry: "Réessayer",
      loadMore: "Charger plus", search: "Rechercher", optional: "facultatif", required: "requis",
      enterPin: "Entrez le code PIN", login: "Connexion", loggingIn: "Connexion...",
      welcome: "Bienvenue", error: "Une erreur est survenue, réessayez", invalidLink: "Lien invalide",
      restaurantNotFound: "Restaurant introuvable", wrongPin: "Code incorrect",
      table: "Table", noComment: "Aucun commentaire",
    },
    theme: { light: "Mode clair", dark: "Mode sombre", enableLight: "Activer le mode clair", enableDark: "Activer le mode sombre" },
    notFound: { title: "Page introuvable", desc: "Peut-être que cette table n'est pas dans notre restaurant" },
    seo: { title: "Gestion intelligente de restaurant", desc: "Tout ce dont votre restaurant a besoin au même endroit", tagline: "Gestion intelligente de restaurant" },
    auth: {
      loginTitle: "Connexion", loginSubtitle: "Connectez-vous pour gérer votre restaurant",
      signupTitle: "Créer un nouveau compte", signupSubtitle: "Commencez à gérer votre restaurant en quelques minutes",
      noAccount: "Pas de compte ?", haveAccount: "Vous avez déjà un compte ?",
      createAccount: "Créer un compte", login: "Connexion",
      email: "E-mail", password: "Mot de passe", passwordHint: "6 caractères minimum",
      creating: "Création...", create: "Créer un compte",
      signedUp: "Compte créé. Confirmez votre e-mail puis connectez-vous.",
    },
    setup: {
      title: "Configuration du restaurant", subtitle: "Entrez les informations de base pour commencer",
      restaurantName: "Nom du restaurant", placeholderName: "ex. Restaurant Al Asala",
      logo: "Logo du restaurant (facultatif)", logoPreview: "Aperçu du logo", chooseLogo: "Cliquez pour choisir une image de logo",
      googleLink: "Lien d'avis Google Maps", googleHint: "Vous pouvez obtenir le lien depuis Google My Business",
      start: "Commencer", savingData: "Enregistrement...",
      nameRequired: "Le nom du restaurant est requis", invalidGoogle: "Lien Google Maps invalide",
      saved: "Informations enregistrées", saveFailed: "Échec de l'enregistrement, réessayez",
      duplicate: "Vous avez déjà un restaurant enregistré", expired: "Session expirée, reconnectez-vous",
    },
    kitchen: { title: "Connexion cuisine", disabled: "Le système cuisine n'est pas activé pour ce restaurant.", enableHint: "Le propriétaire doit l'activer depuis les paramètres." },
    cashier: { title: "Connexion caisse", disabled: "Le système caisse n'est pas encore activé.", enableHint: "Le propriétaire doit l'activer dans les paramètres et définir un PIN.", readyOrders: "Commandes prêtes au paiement", autoAppear: "Les commandes apparaîtront automatiquement" },
    orders: {
      title: "Commandes", new: "Nouveau", preparing: "En préparation", ready: "Prêt", paid: "Payé",
      empty: "Aucune commande", noOrdersIn: "Aucune commande en",
      newOrder: "Nouvelle commande !", table: "Table",
      startPreparing: "Commencer la préparation", markReady: "Prêt", markPaid: "Payé",
      enableSound: "Activer le son", soundOn: "Son activé",
      loadFailed: "Échec du chargement des commandes", updateFailed: "Échec de la mise à jour",
    },
    tables: {
      addTable: "Ajouter une table", emptyHint: "Commencez par ajouter une nouvelle table",
      tableNumber: "Numéro de table", deleteTable: "Supprimer la table",
      mustBeGtZero: "Le numéro doit être supérieur à 0",
      alreadyUsed: "Numéro de table déjà utilisé", addFailed: "Échec de l'ajout",
      added: "Table ajoutée", deleteFailed: "Échec de la suppression", deleted: "Table supprimée",
      loadFailed: "Échec du chargement des tables",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer cette table ?",
      downloadQr: "Télécharger QR", qrFailed: "Échec du téléchargement QR",
      confirmDeleteWithNumber: "Supprimer la table n°{{n}} ? Action irréversible.",
    },
    reviews: {
      avg: "Note moyenne", count: "Nombre d'avis",
      googleRate: "Taux de conversion Google", googleHint: "avis positifs envoyés à Google",
      all: "Tous", positive: "Positifs (4-5⭐)", negative: "Négatifs (1-3⭐)",
      empty: "Aucun avis pour le moment",
      sentToGoogle: "Envoyé à Google", internalOnly: "Interne seulement",
      newPositive: "Nouvel avis positif ⭐", newNegative: "Avis négatif — à traiter",
      loadFailed: "Échec du chargement des avis",
    },
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { ar, en, fr },
      fallbackLng: "ar",
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "lang",
      },
    });
}

export function setHtmlDir(lang: string) {
  if (typeof document === "undefined") return;
  const base = (lang || "ar").split("-")[0];
  document.documentElement.lang = base;
  document.documentElement.dir = base === "ar" ? "rtl" : "ltr";
}

export default i18n;
