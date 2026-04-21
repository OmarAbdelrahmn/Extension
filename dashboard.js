'use strict';

/* ═══════════════════════════════════════════════════════
   RIDER LIVE OPS v3.4 — DASHBOARD JS
   Fixes:
   - isLate() uses ONLY live api status==='late' (not cumulative late_seconds)
   - Map tiles are theme-aware: dark_all ↔ light_all via mapTileUrl()
   - Theme toggle hot-swaps tile URL via mapTileLayer.setUrl() — no rebuild
   - computeStatsFromRiders: no double-counting of late riders
   - Detail tabs made sticky (via .detail-sticky-top wrapper in HTML)
   - Leaflet loaded from libs/ folder (web_accessible_resources)
   ═══════════════════════════════════════════════════════ */

const API      = 'https://sa.me.logisticsbackoffice.com/api';
const REFRESH_MS = 30_000;

// ── CITIES LIST ────────────────────────────────────────
// Each entry: { id, name (EN), nameAr (AR), city_id (used in API) }
const CITIES = [
  {id:6,  name:"Jeddah",                nameAr:"جدة",                   city_id:5},
  {id:14, name:"Al Ahsa",               nameAr:"الأحساء",               city_id:7},
  {id:12, name:"Jubail",                nameAr:"الجبيل",                city_id:8},
  {id:4,  name:"Alkharj",               nameAr:"الخرج",                 city_id:3},
  {id:5,  name:"Medina",                nameAr:"المدينة المنورة",        city_id:4},
  {id:17, name:"Hail",                  nameAr:"حائل",                  city_id:201},
  {id:18, name:"Tabuk",                 nameAr:"تبوك",                  city_id:202},
  {id:19, name:"Taif",                  nameAr:"الطائف",                city_id:203},
  {id:24, name:"Yanbu",                 nameAr:"ينبع",                  city_id:208},
  {id:25, name:"Jazan",                 nameAr:"جازان",                 city_id:209},
  {id:26, name:"Sakaka",                nameAr:"سكاكا",                 city_id:210},
  {id:27, name:"Arar",                  nameAr:"عرعر",                  city_id:211},
  {id:28, name:"Najran",                nameAr:"نجران",                 city_id:212},
  {id:30, name:"Al Quarayat",           nameAr:"القريات",               city_id:214},
  {id:43, name:"Rafha",                 nameAr:"رفحاء",                 city_id:222},
  {id:44, name:"Buqayq",                nameAr:"بقيق",                  city_id:223},
  {id:47, name:"Shaqra",                nameAr:"شقراء",                 city_id:226},
  {id:49, name:"Afif",                  nameAr:"عفيف",                  city_id:228},
  {id:50, name:"Dawadmi",               nameAr:"الدوادمي",              city_id:229},
  {id:51, name:"Nariyah",               nameAr:"النعيرية",              city_id:230},
  {id:52, name:"Rabigh",                nameAr:"رابغ",                  city_id:231},
  {id:126,name:"Ar Rass",               nameAr:"الرس",                  city_id:6},
  {id:58, name:"Turaif",                nameAr:"طريف",                  city_id:237},
  {id:53, name:"Bishah",                nameAr:"بيشة",                  city_id:232},
  {id:59, name:"Sabya",                 nameAr:"صبيا",                  city_id:238},
  {id:60, name:"Al Ula",                nameAr:"العُلا",                city_id:239},
  {id:61, name:"Baha",                  nameAr:"الباحة",                city_id:240},
  {id:62, name:"Al Qaisumah",           nameAr:"القيصومة",              city_id:241},
  {id:40, name:"Riyadh South",          nameAr:"الرياض الجنوبية",       city_id:1},
  {id:37, name:"Eastern Province 2",    nameAr:"المنطقة الشرقية 2",     city_id:219},
  {id:38, name:"Eastern Province 3",    nameAr:"المنطقة الشرقية 3",     city_id:219},
  {id:55, name:"Howtat Bani Tamim",     nameAr:"حوطة بني تميم",         city_id:234},
  {id:67, name:"Al Muzahmiya",          nameAr:"المزاحمية",             city_id:243},
  {id:70, name:"Damd",                  nameAr:"ضمد",                   city_id:246},
  {id:71, name:"Sharorah",              nameAr:"شرورة",                 city_id:247},
  {id:72, name:"Uhed Masarha",          nameAr:"أحد المسارحة",          city_id:248},
  {id:73, name:"Ad Darb",               nameAr:"الدرب",                 city_id:249},
  {id:74, name:"Al Namas",              nameAr:"النماص",                city_id:250},
  {id:75, name:"Baljurashi",            nameAr:"بلجرشي",                city_id:251},
  {id:21, name:"Abha Province",         nameAr:"أبها",                  city_id:205},
  {id:76, name:"Ahad Rafidah",          nameAr:"أحد رفيدة",             city_id:205},
  {id:77, name:"Al Wajh",               nameAr:"الوجه",                 city_id:252},
  {id:78, name:"Duba",                  nameAr:"ضبا",                   city_id:253},
  {id:79, name:"Sarat Abida",           nameAr:"سراة عبيدة",            city_id:254},
  {id:80, name:"Tabarjul",              nameAr:"طبرجل",                 city_id:255},
  {id:81, name:"Tanomah",               nameAr:"تنومة",                 city_id:256},
  {id:82, name:"Al Uwayqilah",          nameAr:"العويقيلة",             city_id:257},
  {id:84, name:"Umluj",                 nameAr:"أملج",                  city_id:259},
  {id:85, name:"Al Quwaiiyah",          nameAr:"القويعية",              city_id:260},
  {id:90, name:"Kaec",                  nameAr:"كيك",                   city_id:262},
  {id:23, name:"Hafar Al Batin",        nameAr:"حفر الباطن",            city_id:207},
  {id:29, name:"Mahayel Asir",          nameAr:"محايل عسير",            city_id:213},
  {id:48, name:"Abu Arish",             nameAr:"أبو عريش",              city_id:227},
  {id:99, name:"Mecca Haram Walkers",   nameAr:"مكة الحرم",             city_id:266},
  {id:100,name:"Neom",                  nameAr:"نيوم",                  city_id:267},
  {id:41, name:"Al Majmaah",            nameAr:"المجمعة",               city_id:220},
  {id:32, name:"Al Qunfudhah",          nameAr:"القنفذة",               city_id:216},
  {id:106,name:"Aramco Compound RT",    nameAr:"مجمع أرامكو رت",        city_id:268},
  {id:108,name:"Bish",                  nameAr:"بيش",                   city_id:270},
  {id:56, name:"Dumah Aj Jandal",       nameAr:"دومة الجندل",           city_id:235},
  {id:45, name:"Wadi Al Dawasir",       nameAr:"وادي الدواسر",          city_id:224},
  {id:110,name:"Al Lith",               nameAr:"الليث",                 city_id:272},
  {id:112,name:"Aramco Compound DH",    nameAr:"مجمع أرامكو ظهران",     city_id:273},
  {id:115,name:"Aramco Compound Buqayq",nameAr:"مجمع أرامكو بقيق",     city_id:274},
  {id:116,name:"Khulais",               nameAr:"خليص",                  city_id:275},
  {id:117,name:"Al Wadeen",             nameAr:"الوادين",               city_id:278},
  {id:118,name:"Mecca South",           nameAr:"مكة الجنوبية",          city_id:200},
  {id:136,name:"Al Jumum",              nameAr:"الجموم",                city_id:281},
  {id:16, name:"Mecca North",           nameAr:"مكة الشمالية",          city_id:200},
  {id:46, name:"Al Khafji",             nameAr:"الخفجي",                city_id:225},
  {id:57, name:"Al Mithnab",            nameAr:"المذنب",                city_id:236},
  {id:54, name:"Ad Dilm",               nameAr:"الدلم",                 city_id:233},
  {id:125,name:"Automation Test",       nameAr:"منتج اختبار",           city_id:280},
  {id:127,name:"Al Badayea",            nameAr:"البدائع",               city_id:6},
  {id:128,name:"Al Bukayriyah",         nameAr:"البكيرية",              city_id:6},
  {id:129,name:"Unayzah",               nameAr:"عنيزة",                 city_id:6},
  {id:130,name:"Buraydah",              nameAr:"بريدة",                 city_id:6},
];

/** Returns city display name in the current UI language. */
function cityName(city) {
  return (currentLang === 'ar' && city.nameAr) ? city.nameAr : city.name;
}

/** Re-labels all options in the city dropdown to match the current language. */
function refreshCityDropdownLabels() {
  const sel = document.getElementById('citySelect');
  if (!sel) return;
  CITIES.forEach((city, i) => {
    if (sel.options[i]) sel.options[i].textContent = cityName(city);
  });
}

// ── DYNAMIC CITY / COMPANY STATE ──────────────────────
let currentCityEntry = CITIES[0]; // default: Jeddah (city_id 5)
let currentCompanyId = null;      // read from API after each city load

// ── STATE ──────────────────────────────────────────────
let allRiders       = [];
let filteredRiders  = [];
let currentFilter   = 'all';
let selectedRiderId = null;
let refreshTimer    = null;
let previousStatuses= {};
let searchQuery     = '';
let sortBy          = 'name';
let isLoading       = false;
let currentPage     = 'dashboard';
let mapMarkers      = [];
let leafletMap      = null;
let mapTileLayer    = null;   // reference kept so we can hot-swap tiles on theme change
let currentLang     = localStorage.getItem('dash_lang')  || 'ar';
let currentTheme    = localStorage.getItem('dash_theme') || 'dark';
let historyRawData  = null;
let historySearchQuery = '';
let riderNamesCache = {};   // riderId (string) → overrideName (string|null)
let subsSearchQuery = '';
let subsRawData     = [];   // raw from GET /api/rider-names/{companyId}

// ── TRANSLATIONS ───────────────────────────────────────
const STRINGS = {
  ar: {
    status_working:'يعمل', status_starting:'بداية', dtstus_starting:'بداية', status_ending:'إنهاء', status_break:'استراحة',
    status_late:'متأخر', status_offline:'غير متصل',
    brand_title:'لوحة تحكم هنقر', brand_sub:'لوحة تحكم هنقر',
    nav_dashboard:'🏠 الرئيسية', nav_wallet:'💰 المحافظ', nav_map:'🗺 الخريطة',
    stat_working:'يعمل', stat_starting:'بداية', stat_break:'استراحة',
    stat_late:'متأخر', stat_orders:'📦 طلب', stat_all:'الكل',
    last_update_label:'آخر تحديث', live:'مباشر', auto_refresh:'تحديث تلقائي',
    filter_all:'الكل', filter_working:'يعمل', filter_starting:'بداية',
    filter_break:'استراحة', filter_late:'⚠ متأخر', filter_orders:'📦 طلب',
    filter_no_orders:'⚪ بدون طلب',
    sort_label:'ترتيب:', sort_name:'الاسم', sort_status:'الحالة',
    sort_deliveries:'التوصيلات', sort_util:'معدل الاستخدام', sort_late:'وقت التأخير',
    search_placeholder:'بحث بالاسم أو الهاتف...',
    cp_title:'أداء الشركة الإجمالي', cp_sub:'أداء الشركة الإجمالي',
    cp_workers:'حالة السائقين', cp_checked_in:'يعمل / بداية', cp_late_lbl:'متأخر',
    cp_offline:'غير متصل', cp_break:'في استراحة', cp_with_orders_lbl:'لديه طلب', cp_without_orders_lbl:'بدون طلب',
    cp_orders_section:'الطلبات', cp_accepted:'طلب مقبول', cp_declined:'طلب مرفوض',
    cp_util_section:'متوسط معدل الاستخدام', cp_vehicles_section:'توزيع المركبات',
    cp_company_section:'ملخص الشركة', cp_footer_hint:'انقر على أي سائق من القائمة لعرض تفاصيله الكاملة',
    cp_loading:'جاري التحميل...', cp_no_data:'لا توجد بيانات',
    cp_table_id:'رقم الشركة', cp_table_active:'السائقون النشطون',
    cp_table_deliveries:'إجمالي التوصيلات', cp_table_util:'متوسط الاستخدام',
    cp_late_alert:'تنبيه:', cp_late_drivers:'سائق متأخر الآن', cp_reassign:'إعادة تعيين:',
    tab_overview:'نظرة عامة', tab_deliveries:'التوصيلات', tab_shifts:'الوردية',
    tab_performance:'الأداء', tab_groupbypoint:'📍 حسب النقطة',
    card_shift:'الوردية الحالية', shift_start:'بداية الوردية', shift_end:'نهاية الوردية',
    shift_remain:'المدة المتبقية', card_vehicle:'المركبة', vehicle_speed_lbl:'السرعة الافتراضية',
    speed_unit:'كم/ساعة', card_wallet:'المحفظة', card_location:'الموقع الحالي',
    loc_lat:'خط العرض', loc_lng:'خط الطول', loc_updated:'آخر تحديث',
    open_map:'🗺 فتح في خرائط جوجل',
    ds_completed:'مكتملة', ds_accepted:'مقبولة', ds_notified:'إشعارات',
    ds_declined:'مرفوضة', ds_stacked:'مكدسة', ds_acceptance:'معدل القبول',
    no_deliveries:'لا توجد توصيلات',
    shifts_loading:'جاري تحميل الورديات...', shifts_id:'رقم الوردية',
    shifts_start:'البداية', shifts_end:'النهاية', shifts_point:'نقطة الانطلاق',
    shifts_status:'الحالة', shifts_duration:'المدة', no_shifts:'لا توجد ورديات',
    perf_util:'معدل الاستخدام', perf_acceptance:'معدل القبول',
    ts_worked:'وقت العمل', ts_late:'وقت التأخير',
    ts_break:'وقت الاستراحة', ts_breaks:'عدد الاستراحات',
    wallet_title:'💰 تقرير المحافظ', wallet_sub:'حد التحذير: 300 ر.س · حد الإيقاف: 500 ر.س',
    wallet_over500:'🔴 فوق 500:', wallet_300_500:'🟠 300-500:', wallet_ok_label:'🟢 طبيعي:', wallet_total_label:'الكل:',
    wallet_export:'تصدير Excel', wallet_col_num:'#', wallet_col_name:'الاسم',
    wallet_col_phone:'الهاتف', wallet_col_point:'نقطة الانطلاق',
    wallet_col_balance:'الرصيد', wallet_col_status:'الحالة', wallet_col_id:'معرف الموظف',
    currency:'ر.س',
    map_title:'🗺 خريطة السائقين المباشرة', map_with_orders:'لديه طلب نشط',
    map_without_orders:'بدون طلب', map_late_legend:'متأخر',
    map_total:'إجمالي على الخريطة:', map_driver:'سائق',
    map_error:'تعذر تحميل مكتبة الخرائط',
    map_error_sub:'ضع ملفات Leaflet في مجلد libs/ داخل الإضافة (leaflet.js و leaflet.css)',
    loading:'جاري التحميل...', no_data:'لا يوجد سائقون مطابقون',
    load_fail:'⚠ فشل التحميل', login_hint:'تأكد من تسجيل الدخول في المنصة',
    has_order:'🟢 طلب', no_order:'⚪',
    del_dispatched:'تم الإرسال', del_courier_notified:'تم الإشعار',
    del_accepted:'مقبولة', del_near_pickup:'قرب الاستلام', del_picked_up:'تم الاستلام',
    del_left_pickup:'غادر الاستلام', del_near_dropoff:'قرب التسليم',
    del_completed:'مكتملة', del_cancelled:'ملغاة',
    shift_published:'منشورة', shift_active:'نشطة', shift_finished:'منتهية', shift_draft:'مسودة',
    wallet_over_hard:'تجاوز الحد الصعب', wallet_over_soft:'تجاوز الحد اللين', wallet_ok:'طبيعي',
    delivery_pickup:'📦 الاستلام', delivery_dropoff:'🏠 التسليم',
    group_no_data:'لا توجد بيانات', group_select_hint:'اختر هذا التبويب لعرض التجميع حسب نقطة الانطلاق',
    pg_working:'يعمل', pg_starting:'بداية', pg_break:'استراحة', pg_late:'متأخر', pg_orders:'لديه طلب',
    theme_light:'☀️ فاتح', theme_dark:'🌙 داكن', lang_toggle:'EN',
    toast_loaded:'تم تحميل', toast_riders:'سائق', toast_fail:'فشل تحميل البيانات',
    toast_exported:'تم تصدير تقرير المحفظة بنجاح', toast_no_export:'لا توجد بيانات للتصدير',
    toast_auto_on:'تحديث تلقائي كل 30 ثانية', toast_auto_off:'تم إيقاف التحديث التلقائي',
    hour_label:'س', min_short:'د', less_min:'< دقيقة',
    not_started:'لم تبدأ بعد', ended:'انتهت', remaining:'متبقي',
    nav_history:'📜 السجل',
    history_title: '📜 سجل إحصائيات السائقين',
    history_sub: 'عرض الإحصائيات لليوم المحدد',
    history_total_riders: 'السائقين:',
    history_total_orders: 'الطلبات:',
    history_total_wallet: 'المحافظ:',
    history_total_hours: 'الساعات:',
    history_refresh: 'تحديث',
    hist_col_num: '#',
    hist_col_name: 'الاسم',
    hist_col_id: 'المعرف',
    hist_col_orders: 'الطلبات',
    hist_col_wallet: 'المحفظة',
    hist_col_hours: 'ساعات العمل',
    hist_col_status: 'الحالة المباشرة',
    hist_not_working: 'لا يعمل حالياً',
    nav_substitutes: '🔁 البدلاء',
    substitutes_title: '🔁 البدلاء — إدارة الأسماء',
    substitutes_sub: 'تخصيص الاسم المعروض لكل سائق عبر التطبيق بالكامل',
    substitutes_total: 'إجمالي السائقين:',
    substitutes_overridden: 'لديهم اسم مخصص:',
    sub_edit_placeholder: 'أدخل اسماً مخصصاً...',
    sub_save: 'حفظ',
    sub_clear: 'مسح',
    sub_saved: 'تم حفظ الاسم بنجاح',
    sub_cleared: 'تم مسح الاسم المخصص',
    sub_error: 'فشل حفظ الاسم',
    sub_original_name: 'الاسم الأصلي',
    sub_custom_name: 'الاسم المخصص',
  },
  en: {
    status_working:'Working', status_starting:'Starting', dtstus_starting:'Starting', status_ending:'Ending', status_break:'On Break',
    status_late:'Late', status_offline:'Offline',
    brand_title:'Hunger Dashboard', brand_sub:'Hunger Dashboard',
    nav_dashboard:'🏠 Dashboard', nav_wallet:'💰 Wallets', nav_map:'🗺 Map',
    stat_working:'Working', stat_starting:'Starting', stat_break:'Break',
    stat_late:'Late', stat_orders:'📦 Orders', stat_all:'All',
    last_update_label:'Last Update', live:'Live', auto_refresh:'Auto Refresh',
    filter_all:'All', filter_working:'Working', filter_starting:'Starting',
    filter_break:'Break', filter_late:'⚠ Late', filter_orders:'📦 Orders',
    filter_no_orders:'⚪ No Orders',
    sort_label:'Sort:', sort_name:'Name', sort_status:'Status',
    sort_deliveries:'Deliveries', sort_util:'Utilization', sort_late:'Late Time',
    search_placeholder:'Search by name or phone...',
    cp_title:'Overall Company Performance', cp_sub:'Overall Company Performance',
    cp_workers:'Rider Status', cp_checked_in:'Working / Starting', cp_late_lbl:'Late',
    cp_offline:'Offline', cp_break:'On Break', cp_with_orders_lbl:'Has Order', cp_without_orders_lbl:'No Orders',
    cp_orders_section:'Orders', cp_accepted:'Accepted Order', cp_declined:'Declined Order',
    cp_util_section:'Average Utilization Rate', cp_vehicles_section:'Vehicle Distribution',
    cp_company_section:'Company Summary', cp_footer_hint:'Click any rider in the list to view full details',
    cp_loading:'Loading...', cp_no_data:'No data',
    cp_table_id:'Company ID', cp_table_active:'Active Riders',
    cp_table_deliveries:'Total Deliveries', cp_table_util:'Avg Utilization',
    cp_late_alert:'Alert:', cp_late_drivers:'riders late now', cp_reassign:'Reassignments:',
    tab_overview:'Overview', tab_deliveries:'Deliveries', tab_shifts:'Shifts',
    tab_performance:'Performance', tab_groupbypoint:'📍 By Point',
    card_shift:'Current Shift', shift_start:'Shift Start', shift_end:'Shift End',
    shift_remain:'Remaining', card_vehicle:'Vehicle', vehicle_speed_lbl:'Default Speed',
    speed_unit:'km/h', card_wallet:'Wallet', card_location:'Current Location',
    loc_lat:'Latitude', loc_lng:'Longitude', loc_updated:'Last Updated',
    open_map:'🗺 Open in Google Maps',
    ds_completed:'Completed', ds_accepted:'Accepted', ds_notified:'Notified',
    ds_declined:'Declined', ds_stacked:'Stacked', ds_acceptance:'Acceptance Rate',
    no_deliveries:'No deliveries found',
    shifts_loading:'Loading shifts...', shifts_id:'Shift ID',
    shifts_start:'Start', shifts_end:'End', shifts_point:'Starting Point',
    shifts_status:'Status', shifts_duration:'Duration', no_shifts:'No shifts found',
    perf_util:'Utilization Rate', perf_acceptance:'Acceptance Rate',
    ts_worked:'Worked Time', ts_late:'Late Time',
    ts_break:'Break Time', ts_breaks:'Break Count',
    wallet_title:'💰 Wallet Report', wallet_sub:'Soft Limit: 300 SAR · Hard Limit: 500 SAR',
    wallet_over500:'🔴 Over 500:', wallet_300_500:'🟠 300-500:', wallet_ok_label:'🟢 Normal:', wallet_total_label:'Total:',
    wallet_export:'Export Excel', wallet_col_num:'#', wallet_col_name:'Name',
    wallet_col_phone:'Phone', wallet_col_point:'Starting Point',
    wallet_col_balance:'Balance', wallet_col_status:'Status', wallet_col_id:'Employee ID',
    currency:'SAR',
    map_title:'🗺 Live Rider Map', map_with_orders:'Has Active Order',
    map_without_orders:'No Order', map_late_legend:'Late',
    map_total:'Total on map:', map_driver:'riders',
    map_error:'Failed to load map library',
    map_error_sub:'Place Leaflet files inside libs/ folder of the extension (leaflet.js and leaflet.css)',
    loading:'Loading...', no_data:'No matching riders',
    load_fail:'⚠ Load Failed', login_hint:'Make sure you are logged in to the platform',
    has_order:'🟢 Order', no_order:'⚪',
    del_dispatched:'Dispatched', del_courier_notified:'Notified',
    del_accepted:'Accepted', del_near_pickup:'Near Pickup', del_picked_up:'Picked Up',
    del_left_pickup:'Left Pickup', del_near_dropoff:'Near Dropoff',
    del_completed:'Completed', del_cancelled:'Cancelled',
    shift_published:'Published', shift_active:'Active', shift_finished:'Finished', shift_draft:'Draft',
    wallet_over_hard:'Over Hard Limit', wallet_over_soft:'Over Soft Limit', wallet_ok:'Normal',
    delivery_pickup:'📦 Pickup', delivery_dropoff:'🏠 Dropoff',
    group_no_data:'No data available', group_select_hint:'Select this tab to view grouping by starting point',
    pg_working:'Working', pg_starting:'Starting', pg_break:'Break', pg_late:'Late', pg_orders:'Has Order',
    theme_light:'☀️ Light', theme_dark:'🌙 Dark', lang_toggle:'ع',
    toast_loaded:'Loaded', toast_riders:'riders', toast_fail:'Failed to load data',
    toast_exported:'Wallet report exported successfully', toast_no_export:'No data to export',
    toast_auto_on:'Auto-refresh every 30 seconds', toast_auto_off:'Auto-refresh disabled',
    hour_label:'h', min_short:'m', less_min:'< 1 min',
    not_started:'Not started yet', ended:'Ended', remaining:'remaining',
    nav_history:'📜 History',
    history_title: '📜 Rider Stats History',
    history_sub: 'View statistics for selected date',
    history_total_riders: 'Riders:',
    history_total_orders: 'Orders:',
    history_total_wallet: 'Wallets:',
    history_total_hours: 'Hours:',
    history_refresh: 'Refresh',
    hist_col_num: '#',
    hist_col_name: 'Name',
    hist_col_id: 'ID',
    hist_col_orders: 'Orders',
    hist_col_wallet: 'Wallet',
    hist_col_hours: 'Working Hours',
    hist_col_status: 'Live Status',
    hist_not_working: 'Not Working',
    nav_substitutes: '🔁 Substitutes',
    substitutes_title: '🔁 Substitutes — Name Management',
    substitutes_sub: 'Customize the display name for each rider across the entire app',
    substitutes_total: 'Total Riders:',
    substitutes_overridden: 'Custom Name Set:',
    sub_edit_placeholder: 'Enter a custom name...',
    sub_save: 'Save',
    sub_clear: 'Clear',
    sub_saved: 'Name saved successfully',
    sub_cleared: 'Custom name cleared',
    sub_error: 'Failed to save name',
    sub_original_name: 'Original Name',
    sub_custom_name: 'Custom Name',
  }
};

function t(key) {
  return (STRINGS[currentLang] && STRINGS[currentLang][key]) ||
         (STRINGS['ar'][key]) || key;
}

// ── THEME & LANGUAGE ───────────────────────────────────

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = currentTheme === 'dark' ? t('theme_light') : t('theme_dark');
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('dash_theme', currentTheme);
  applyTheme();

  // Hot-swap Leaflet tile layer so the map reflects the new theme immediately.
  // We change the URL on the existing layer — no full map rebuild needed.
  if (mapTileLayer) {
    mapTileLayer.setUrl(mapTileUrl());
  }
}

function applyLanguage() {
  const isAr = currentLang === 'ar';
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });

  const so = document.getElementById('sortSelect');
  if (so) {
    so.options[0].text = t('sort_name');
    so.options[1].text = t('sort_status');
    so.options[2].text = t('sort_deliveries');
    so.options[3].text = t('sort_util');
    so.options[4].text = t('sort_late');
  }

  const langBtn = document.getElementById('btnLang');
  if (langBtn) langBtn.textContent = t('lang_toggle');
  applyTheme();

  if (allRiders.length) {
    applyFiltersAndSort();
    renderCompanyStats(computeStatsFromRiders(allRiders));
    if (selectedRiderId) {
      const riderData = allRiders.find(r => r.employee_id === selectedRiderId);
      if (riderData) renderRiderHeader(riderData);
    }
  }
  // Re-label city dropdown in the new language
  refreshCityDropdownLabels();
}

function toggleLang() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('dash_lang', currentLang);
  applyLanguage();
}

// ── LABEL MAPS ─────────────────────────────────────────

const STATUS_BADGE = {
  working:  'badge-working',
  starting: 'badge-starting',
  dtstus_starting: 'badge-starting',
  ending:   'badge-ending',
  break:    'badge-break',
  late:     'badge-late',
  offline:  'badge-offline',
};

const DELIVERY_STATUS_KEY = {
  dispatched:       'del_dispatched',
  courier_notified: 'del_courier_notified',
  accepted:         'del_accepted',
  near_pickup:      'del_near_pickup',
  picked_up:        'del_picked_up',
  left_pickup:      'del_left_pickup',
  near_dropoff:     'del_near_dropoff',
  completed:        'del_completed',
  cancelled:        'del_cancelled',
};

const SHIFT_STATE_KEY = {
  PUBLISHED: 'shift_published',
  ACTIVE:    'shift_active',
  FINISHED:  'shift_finished',
  DRAFT:     'shift_draft',
};

const VEHICLE_ICONS = {
  Motorbike:  '🏍',
  Motor_Bike: '🏍',
  Bicycle:    '🚲',
  Car:        '🚗',
};

// ── HELPERS ────────────────────────────────────────────

/**
 * Returns the raw status from the API (normalized to lowercase).
 * This is the single source of truth for a rider's status.
 */
function effectiveStatus(rider) {
  return (rider.status || 'offline').toLowerCase();
}

/**
 * TRUE when a rider is CURRENTLY late right now.
 *
 * ── Why only effectiveStatus() and NOT late_seconds? ──────────
 * rider.performance.time_spent.late_seconds is a CUMULATIVE counter
 * that grows all shift long. A rider who was late at 9 AM and then
 * recovered will still have late_seconds > 0 at 3 PM, even though
 * they are perfectly on time now.
 *
 * The API's rider.status field is updated in real-time and is set to
 * "late" only when the rider is CURRENTLY in a late state. That is
 * the correct signal for the live filter, badge, and map marker colour.
 *
 * late_seconds is still used in the Performance tab to show total
 * accumulated late time — which is a valid historical metric.
 * ──────────────────────────────────────────────────────────────
 */
function isLate(rider) {
  if (!rider) return false;
  return effectiveStatus(rider) === 'late';
}

function hasActiveOrder(rider) {
  return !!(rider.deliveries_info?.has_active_deliveries);
}

function cleanName(name) {
  if (!name) return '—';
  return name.replace(/\*\d+\*/g, '').trim() || name.trim();
}

/**
 * Global name resolver. Returns the overrideName from the cache if set,
 * otherwise falls back to cleanName(rider.name) from RiderStat.
 * Use this EVERYWHERE a rider name is displayed.
 */
function getRiderDisplayName(rider) {
  if (!rider) return '—';
  const id = String(rider.employee_id ?? '');
  const override = riderNamesCache[id];
  return (override && override.trim()) ? override.trim() : cleanName(rider.name);
}

function avatarClass(name) {
  if (!name) return 'av-4';
  return `av-${name.charCodeAt(0) % 5}`;
}

function avatarInitial(name) {
  const c = cleanName(name);
  return c.charAt(0) || '?';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-GB',
    { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatSeconds(sec) {
  if (!sec || sec === 0) return `0 ${t('min_short')}`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h}${t('hour_label')}`);
  if (m) parts.push(`${m}${t('min_short')}`);
  return parts.join(' ') || t('less_min');
}

function shiftDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}${t('hour_label')} ${m}${t('min_short')}`;
}

function shiftRemaining(start, end) {
  if (!start || !end) return { text: '—', pct: 0 };
  const now = new Date(), s = new Date(start), e = new Date(end);
  if (now < s) return { text: t('not_started'), pct: 0 };
  if (now > e) return { text: t('ended'), pct: 100 };
  const pct = Math.round(((now - s) / (e - s)) * 100);
  const rem = Math.floor((e - now) / 60_000);
  return {
    text: `${Math.floor(rem / 60)}${t('hour_label')} ${rem % 60}${t('min_short')} ${t('remaining')}`,
    pct,
  };
}

function walletStatus(status, balance) {
  if (balance !== undefined && balance !== null) {
    if (balance >= 500) return { text: t('wallet_over_hard'), cls: 'wallet-over-hard' };
    if (balance >= 300) return { text: t('wallet_over_soft'), cls: 'wallet-over-soft' };
    return               { text: t('wallet_ok'),         cls: 'wallet-ok' };
  }
  const map = {
    balance_over_hard_limit: { text: t('wallet_over_hard'), cls: 'wallet-over-hard' },
    balance_over_soft_limit: { text: t('wallet_over_soft'), cls: 'wallet-over-soft' },
    ok:                      { text: t('wallet_ok'),        cls: 'wallet-ok' },
  };
  return map[status] || { text: status || '—', cls: '' };
}

function toast(msg, type = 'info', ms = 3000) {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, ms);
}

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!globalThis.notifAudioCtx) globalThis.notifAudioCtx = new AudioContext();
    const ctx = globalThis.notifAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch(e) { console.warn('Audio play failed', e); }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

// ── API CALLS ──────────────────────────────────────────

// A helper to get a cookie value
function getCookieValue(name) {
  return new Promise((resolve) => {
    if (chrome && chrome.cookies) {
      chrome.cookies.get({ url: 'https://sa.me.logisticsbackoffice.com', name }, (cookie) => {
        resolve(cookie ? cookie.value : null);
      });
    } else {
      console.error("chrome.cookies API not available.");
      resolve(null);
    }
  });
}

async function apiFetch(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'API_FETCH', url }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('No response from background worker'));
        return;
      }
      if (response.error === 'CF_AUTH') {
        reject(new CfAuthError('Cloudflare session expired — please log in to the website first'));
        return;
      }
      if (response.error === 'NO_TAB') {
        reject(new Error('افتح الموقع https://sa.me.logisticsbackoffice.com أولاً ثم حاول مجدداً'));
        return;
      }
      if (response.error) {
        reject(new Error(`${response.error} — ${url}`));
        return;
      }
      resolve(response.data);
    });
  });
}
 

class CfAuthError extends Error {
  constructor(msg) { super(msg); this.name = 'CfAuthError'; }
}

async function fetchCityCompanyStats() {
  // Returns the full company stats object for the current city
  return apiFetch(`${API}/rider-live-operations/v1/external/city/${currentCityEntry.city_id}/companies`);
}

async function fetchRiders() {
  try {
    const cityStats = await fetchCityCompanyStats();
    const companies = cityStats.company_stats || [];
    if (companies.length > 0) currentCompanyId = companies[0].company_id;
  } catch (_) {}

  const data = await apiFetch(
    `${API}/rider-live-operations/v1/external/city/${currentCityEntry.city_id}/riders?page=0&size=99`
  );
  return data.content || [];
}

//   let allRiders = [];
//   let page = 0;
//   const size = 20; // Modified to 10 as strict WAF or API pagination limits may reject 100 with a 403

//   // New paginated response structure requires looping to fetch all riders
//   while (true) {
//     const data = await apiFetch(
//       `${API}/rider-live-operations/v1/external/city/${currentCityEntry.city_id}/riders?page=${page}&size=${size}`
//     );
//     const content = data.content || [];
//     allRiders.push(...content);

//     // Stop fetching if we've reached the last page or it's empty
//     if (data.is_last || content.length === 0 || data.total_pages === undefined || page >= (data.total_pages - 1)) {
//       break;
//     }
//     page++;
    
//     // Failsafe to prevent excessive loops (e.g. max 50 pages = 5000 riders)
//     if (page >= 50) break;
//   }
//   return allRiders;
// }

async function fetchRiderDetails(id) {
  return apiFetch(`${API}/rider-live-operations/v2/external/rider/${id}`);
}

async function fetchRiderShifts(id) {
  const ms    = Date.now();
  const start = new Date(ms - 7 * 86_400_000).toISOString();
  const end   = new Date(ms + 14 * 86_400_000).toISOString();
  const qs = new URLSearchParams({ city_id: currentCityEntry.city_id, start_at: start, end_at: end });
  return apiFetch(`${API}/rooster/v3/employees/${id}/shifts?${qs}`);
}

// ── RIDER NAMES API (البدلاء) ─────────────────────────

const RIDER_NAMES_API = 'https://express-extension-manager.premiumasp.net/api/rider-names';

/** POST sync — register all current rider IDs (new ones get added, existing ignored) */
async function syncRiderIds(companyId, riderIds) {
  if (!companyId || !riderIds || !riderIds.length) return;
  try {
    await fetch(`${RIDER_NAMES_API}/${companyId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(riderIds),
    });
  } catch (e) {
    console.warn('syncRiderIds error:', e);
  }
}

/** GET all rider name overrides for this company */
async function fetchRiderNames(companyId) {
  if (!companyId) return [];
  const res = await fetch(`${RIDER_NAMES_API}/${companyId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** PUT — set/update the display name for one rider */
async function putRiderName(companyId, riderId, overrideName) {
  const res = await fetch(`${RIDER_NAMES_API}/${companyId}/${riderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overrideName }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Rebuild the in-memory cache from the raw names array */
function buildRiderNamesCache(namesList) {
  riderNamesCache = {};
  (namesList || []).forEach(entry => {
    riderNamesCache[String(entry.riderId)] = entry.overrideName || null;
  });
}

// ── STATS FROM RIDERS ──────────────────────────────────
/*
  FIX: Previously stats.late was incremented TWICE:
    1) effectiveStatus(r) === 'late'  → stats['late']++
    2) isLate(r) (late_seconds > 0)  → stats.late++
  Now: we only count a rider's API status in the status buckets
  (working / starting / break / offline), and keep late as a
  separate orthogonal counter via isLate().
  A rider with status==='late' is still shown as late in the badge
  because STATUS_BADGE['late'] exists.
*/
function computeStatsFromRiders(riders) {
  const stats = {
    working: 0, starting: 0, break: 0, offline: 0,
    late: 0,   // counted separately via isLate()
    withOrders: 0, withoutOrders: 0, total: riders.length,
    walletOverHard: 0, walletOverSoft: 0, walletOk: 0,
    totalCompleted: 0, byPoint: {}, vehicles: {},
    utilTotal: 0, utilCount: 0, ordersAccepted: 0, ordersDeclined: 0,
  };

  riders.forEach(r => {
    const st = effectiveStatus(r);

    // Count each rider in their API status bucket
    // (working / starting / break / offline / late)
    // Note: 'late' riders are NOT double-added below; isLate() handles the late counter.
    if (st === 'working' || st === 'ending')  stats.working++;
    else if (st === 'starting' || st === 'dtstus_starting') stats.starting++;
    else if (st === 'break')    stats.break++;
    else if (st === 'offline')  stats.offline++;
    // riders with status==='late' are not counted in the above buckets —
    // they are only reflected in the late counter below.

    // Late counter: covers status==='late' AND riders with late_seconds > 0
    if (isLate(r)) stats.late++;

    const hasOrd = hasActiveOrder(r);
    if (hasOrd) {
      stats.withOrders++;
    } else if (['working', 'starting', 'late', 'ending', 'dtstus_starting'].includes(st)) {
      stats.withoutOrders++;
    }

    const bal = r.wallet_info?.balance;
    if (bal !== undefined && bal !== null) {
      if (bal >= 500)      stats.walletOverHard++;
      else if (bal >= 300) stats.walletOverSoft++;
      else                 stats.walletOk++;
    }

    stats.totalCompleted  += r.deliveries_info?.completed_deliveries_count || 0;
    stats.ordersAccepted  += r.deliveries_info?.accepted_deliveries_count  || 0;

    const ptName = r.starting_point?.name || 'غير محدد';
    if (!stats.byPoint[ptName]) {
      stats.byPoint[ptName] = { working:0, starting:0, break:0, late:0, total:0, withOrders:0, withoutOrders:0 };
    }
    const pg = stats.byPoint[ptName];
    pg.total++;
    if (st === 'working' || st === 'ending')       pg.working++;
    else if (st === 'starting' || st === 'dtstus_starting') pg.starting++;
    else if (st === 'break')    pg.break++;
    if (isLate(r)) pg.late++;
    if (hasOrd) pg.withOrders++;
    else if (['working','starting','late','ending','dtstus_starting'].includes(st)) pg.withoutOrders++;

    const vIcon = r.vehicle?.icon || 'Unknown';
    stats.vehicles[vIcon] = (stats.vehicles[vIcon] || 0) + 1;

    const util = r.performance?.utilization_rate;
    if (util !== undefined && util !== null) {
      stats.utilTotal += util;
      stats.utilCount++;
    }
  });

  stats.avgUtil = stats.utilCount > 0
    ? Math.round((stats.utilTotal / stats.utilCount) * 100)
    : 0;

  return stats;
}

// ── COMPANY STATS RENDER ───────────────────────────────

function renderCompanyStats(stats) {
  // "يعمل / بداية" card shows working + starting (late riders shown separately)
  setText('cp-checkedIn',      stats.working + stats.starting);
  setText('cp-checkedInLate',  stats.late);
  setText('cp-withoutOrders',  stats.withoutOrders);
  setText('cp-onBreak',        stats.break);
  setText('cp-ordersAccepted', stats.ordersAccepted);
  setText('cp-ordersDeclined', stats.ordersDeclined || 0);
  setText('cp-utilRate',       `${stats.avgUtil}%`);

  const bar = document.getElementById('cp-utilBar');
  if (bar) bar.style.width = `${Math.min(stats.avgUtil, 100)}%`;

  const banner = document.getElementById('cpLateBanner');
  if (banner) {
    banner.style.display = stats.late > 0 ? 'flex' : 'none';
    setText('cp-lateWorkers',    stats.late);
    setText('cp-reassignments',  0);
  }

  const vRow = document.getElementById('cp-vehicles');
  if (vRow) {
    const entries = Object.entries(stats.vehicles);
    if (entries.length) {
      vRow.innerHTML = entries.map(([icon, count]) => {
        const emoji = VEHICLE_ICONS[icon] || '🛵';
        return `<div class="cp-vehicle-chip">
          <span class="cp-vehicle-chip-icon">${emoji}</span>
          <div><div class="cp-vehicle-chip-name">${icon}</div></div>
          <span class="cp-vehicle-chip-count">${count}</span>
        </div>`;
      }).join('');
    } else {
      vRow.innerHTML = `<span class="cp-loading-text">${t('cp_no_data')}</span>`;
    }
  }

  setText('cp-withOrders', stats.withOrders);

  // Update company sub-label with live company ID
  const cpSubEl = document.querySelector('[data-i18n="cp_sub"]');
  if (cpSubEl && currentCompanyId) {
    const cityName = currentCityEntry.name;
    cpSubEl.textContent = currentLang === 'ar'
      ? `شركة ${currentCompanyId} · ${cityName} · المدينة ${currentCityEntry.city_id}`
      : `Company ${currentCompanyId} · ${cityName} · District ${currentCityEntry.city_id}`;
  }

  const tbody = document.getElementById('cp-statsBody');
  if (tbody) {
    const companyDisplay = currentCompanyId ?? '—';
    tbody.innerHTML = `
      <tr>
        <td>${companyDisplay}</td>
        <td style="color:var(--green)">${stats.working + stats.starting}</td>
        <td style="color:var(--amber)">${stats.totalCompleted}</td>
        <td style="color:var(--blue)">${stats.avgUtil}%</td>
      </tr>`;
  }

  const spinner = document.getElementById('cpLoadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

// ── RIDER LIST RENDER ──────────────────────────────────

function buildRiderCard(rider) {
  const status   = effectiveStatus(rider);
  const late     = isLate(rider);
  const hasOrder = hasActiveOrder(rider);
  const avCls    = avatarClass(rider.name);
  const delivs   = rider.deliveries_info?.completed_deliveries_count || 0;
  const isSelected = rider.employee_id === selectedRiderId;
  const displayName = getRiderDisplayName(rider);

  const card = document.createElement('div');
  card.className = `rider-card${late ? ' late-card' : ''}${isSelected ? ' selected' : ''}`;
  card.dataset.id = rider.employee_id;

  const statusLabel = t(`status_${status}`) || status;
  const badgeCls    = STATUS_BADGE[status] || 'badge-offline';

  card.innerHTML = `
    ${late ? '<div class="late-indicator"></div>' : ''}
    <div class="rider-avatar ${avCls}">${avatarInitial(rider.name)}</div>
    <div class="rider-card-info">
      <div class="rider-card-name">${displayName} <span style="font-size:11px;color:var(--text-muted);font-weight:normal">#${rider.employee_id}</span></div>
      <div class="rider-card-sub">${rider.starting_point?.name || '—'} · ${rider.phone_number || '—'}</div>
    </div>
    <div class="rider-card-meta">
      <span class="badge ${badgeCls}">${statusLabel}</span>
      <span class="deliveries-mini">${hasOrder ? t('has_order') : t('no_order')} ${delivs}</span>
    </div>`;

  card.addEventListener('click', () => selectRider(rider.employee_id));
  return card;
}

function renderRiderList() {
  const list = document.getElementById('riderList');
  list.innerHTML = '';
  if (!filteredRiders.length) {
    list.innerHTML = `<div class="no-data">${t('no_data')}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filteredRiders.forEach((r, i) => {
    const card = buildRiderCard(r);
    card.style.animationDelay = `${Math.min(i * 18, 400)}ms`;
    frag.appendChild(card);
  });
  list.appendChild(frag);
}

function updateHeaderStats(riders) {
  const stats = computeStatsFromRiders(riders);
  setText('stat-working',  stats.working);
  setText('stat-starting', stats.starting);
  setText('stat-break',    stats.break);
  setText('stat-late',     stats.late);
  setText('stat-orders',   stats.withOrders);
  setText('stat-total',    stats.total);
  return stats;
}

function applyFiltersAndSort() {
  let list = [...allRiders];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(r =>
      cleanName(r.name).toLowerCase().includes(q) ||
      (r.phone_number || '').includes(q) ||
      String(r.employee_id).includes(q)
    );
  }

  switch (currentFilter) {
    case 'orders':
      list = list.filter(r => hasActiveOrder(r));
      break;
    case 'no-orders':
      list = list.filter(r =>
        ['working', 'starting', 'late'].includes(effectiveStatus(r)) && !hasActiveOrder(r)
      );
      break;
    case 'late':
      // isLate() covers both status==='late' AND late_seconds > 0
      list = list.filter(r => isLate(r));
      break;
    case 'all':
      break;
    default:
      // For working/starting/break/offline filters use the API status field directly
      list = list.filter(r => effectiveStatus(r) === currentFilter);
  }

  list.sort((a, b) => {
    switch (sortBy) {
      case 'name':        return cleanName(a.name).localeCompare(cleanName(b.name), currentLang);
      case 'status':      return effectiveStatus(a).localeCompare(effectiveStatus(b));
      case 'deliveries':  return (b.deliveries_info?.completed_deliveries_count || 0) - (a.deliveries_info?.completed_deliveries_count || 0);
      case 'utilization': return (b.performance?.utilization_rate || 0) - (a.performance?.utilization_rate || 0);
      case 'late':        return (b.performance?.time_spent?.late_seconds || 0) - (a.performance?.time_spent?.late_seconds || 0);
      default: return 0;
    }
  });

  // Bubble late riders to top in 'all' view
  if (currentFilter === 'all') {
    list.sort((a, b) => (isLate(b) ? 1 : 0) - (isLate(a) ? 1 : 0));
  }

  filteredRiders = list;
  renderRiderList();
}

// ── LOAD RIDERS ────────────────────────────────────────

async function loadRiders(silent = false) {
  if (isLoading) return;
  isLoading = true;

  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('spinning');

  if (!silent) {
    document.getElementById('riderList').innerHTML = `
      <div class="loading-state"><div class="spinner"></div><p>${t('loading')}</p></div>`;
  }

  try {
    allRiders = await fetchRiders();

    // مزامنة المعرفات وتحديث ذاكرة التخصيص
    if (currentCompanyId && allRiders.length) {
      const ids = allRiders.map(r => String(r.employee_id));
      syncRiderIds(currentCompanyId, ids); // fire-and-forget — adds new IDs only
      try {
        const namesList = await fetchRiderNames(currentCompanyId);
        subsRawData = namesList;
        buildRiderNamesCache(namesList);
      } catch (e) {
        console.warn('fetchRiderNames error:', e);
      }
    }

    if (Object.keys(previousStatuses).length > 0) {
      let statusChanged = false;
      allRiders.forEach(r => {
        const id = r.employee_id;
        const newStatus = effectiveStatus(r);
        const oldStatus = previousStatuses[id];
        if (oldStatus && oldStatus !== newStatus) {
          statusChanged = true;
          const name = cleanName(r.name);
          const oldLbl = t('status_'+oldStatus) || oldStatus;
          const newLbl = t('status_'+newStatus) || newStatus;
          const msg = currentLang === 'ar' 
            ? `تغيرت حالة السائق ${name} (#${id}) من «${oldLbl}» إلى «${newLbl}»`
            : `${name} (#${id}): ${oldLbl} ➔ ${newLbl}`;
          toast(msg, 'info', 10000);
        }
        previousStatuses[id] = newStatus;
      });
      if (statusChanged) playNotificationSound();
    } else {
      allRiders.forEach(r => previousStatuses[r.employee_id] = effectiveStatus(r));
    }

    const stats = updateHeaderStats(allRiders);
    applyFiltersAndSort();
    renderCompanyStats(stats);
    setText('lastUpdate', new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-GB'));
    if (!silent) toast(`${t('toast_loaded')} ${allRiders.length} ${t('toast_riders')}`, 'success');

    if (allRiders.length > 0 && currentCompanyId) {
      setTimeout(() => sendRiderStatsJob(), 2000);
    }
} catch (err) {
    console.error('loadRiders:', err);
    if (!silent) {
      const isCfError = err instanceof CfAuthError;
      document.getElementById('riderList').innerHTML = `
        <div class="no-data">
          ${isCfError
            ? `🔐 <b>انتهت جلسة Cloudflare</b><br>
               <small>افتح <a href="https://sa.me.logisticsbackoffice.com" target="_blank" 
               style="color:var(--amber)">الموقع</a> وسجّل الدخول، ثم حدّث اللوحة.</small>`
            : `${t('load_fail')}<br><small>${err.message}</small><br><br>
               <small>${t('login_hint')}</small>`
          }
        </div>`;
      toast(isCfError ? '🔐 جلسة Cloudflare منتهية' : t('toast_fail'), 'error', 8000);
    }
  } finally {
    isLoading = false;
    if (btn) btn.classList.remove('spinning');
  }
}

// ── SELECT RIDER ───────────────────────────────────────

async function selectRider(id) {
  selectedRiderId = id;

  document.querySelectorAll('.rider-card').forEach(c =>
    c.classList.toggle('selected', Number(c.dataset.id) === id)
  );

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('riderDetail').style.display = 'flex';
  switchTab('overview');

  // Scroll detail panel back to top so the sticky header+tabs are visible
  const panel = document.getElementById('detailPanel');
  if (panel) panel.scrollTop = 0;

  try {
    const rider = await fetchRiderDetails(id);
    renderRiderHeader(rider);
    renderOverviewTab(rider);
    renderDeliveriesTab(rider);
    renderPerformanceTab(rider);
    loadShifts(id);
  } catch (err) {
    console.error('selectRider:', err);
    toast(t('toast_fail'), 'error');
  }
}

async function loadShifts(id) {
  const loading = document.getElementById('shiftsLoading');
  const content = document.getElementById('shiftsContent');
  loading.style.display = 'flex';
  content.style.display = 'none';
  try {
    const shifts = await fetchRiderShifts(id);
    renderShiftsTab(shifts);
    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    loading.innerHTML = `<p style="color:var(--red)">⚠ ${t('toast_fail')}</p>`;
  }
}

// ── RENDER RIDER DETAIL ────────────────────────────────

function renderRiderHeader(rider) {
  const status = effectiveStatus(rider);
  const avCls  = avatarClass(rider.name);

  const av = document.getElementById('detailAvatar');
  av.textContent = avatarInitial(rider.name);
  av.className   = `detail-avatar ${avCls}`;

  setText('detailName', `${getRiderDisplayName(rider)} (#${rider.employee_id})`);

  const badge = document.getElementById('detailStatusBadge');
  badge.textContent = t(`status_${status}`) || status;
  badge.className   = `status-badge ${STATUS_BADGE[status] || 'badge-offline'}`;

  setText('detailPhone',   `📞 ${rider.phone_number || '—'}`);
  setText('detailPoint',   `📍 ${rider.starting_point?.name || '—'}`);
  setText('detailCompany', `🏢 ${t('cp_sub').split('·')[0].trim()} ${rider.company_id || '—'}`);
}

function renderOverviewTab(rider) {
  const s = rider.active_shift_started_at;
  const e = rider.active_shift_ended_at;
  setText('shiftStart', formatDateTime(s));
  setText('shiftEnd',   formatDateTime(e));

  const { text, pct } = shiftRemaining(s, e);
  setText('shiftRemain', text);
  const fill = document.getElementById('shiftProgressFill');
  if (fill) fill.style.width = `${pct}%`;

  const v = rider.vehicle;
  setText('vehicleName',  v?.name || '—');
  setText('vehicleSpeed', v?.default_speed ? `${v.default_speed} ${t('speed_unit')}` : '—');

  const wal = rider.wallet_info;
  const bal = wal?.balance;
  setText('walletBalance', bal !== undefined ? `${bal.toFixed(2)} ${t('currency')}` : '—');

  const ws = walletStatus(wal?.limit_status, bal);
  const wsEl = document.getElementById('walletStatus');
  if (wsEl) { wsEl.textContent = ws.text; wsEl.className = `wallet-status ${ws.cls}`; }

  const loc = rider.current_location;
  setText('locLat',     loc?.latitude?.toFixed(6));
  setText('locLng',     loc?.longitude?.toFixed(6));
  setText('locUpdated', formatDateTime(loc?.location_updated_at));

  const link = document.getElementById('mapLink');
  if (link) {
    if (loc?.latitude && loc?.longitude) {
      link.href = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
      link.textContent = t('open_map');
      link.style.display = 'inline-block';
    } else {
      link.style.display = 'none';
    }
  }
}

function renderDeliveriesTab(rider) {
  const di = rider.deliveries_info || {};
  setText('ds-completed', di.completed_deliveries_count || 0);
  setText('ds-accepted',  di.accepted_deliveries_count  || 0);
  setText('ds-notified',  di.notified_deliveries_count  || 0);
  setText('ds-declined',  di.declined_deliveries_count  || 0);
  setText('ds-stacked',   di.stacked_deliveries_count   || 0);

  const acc = rider.performance?.acceptance_rate;
  setText('ds-acceptance', acc !== undefined ? `${Math.round(acc * 100)}%` : '—');

  const list = document.getElementById('deliveriesList');
  const deliveries = di.latest_deliveries || [];
  if (!deliveries.length) {
    list.innerHTML = `<div class="no-data">${t('no_deliveries')}</div>`;
    return;
  }

  const STEPS = ['dispatched', 'accepted', 'picked_up', 'near_dropoff', 'completed'];
  list.innerHTML = '';

  deliveries.forEach(d => {
    const tl = d.timeline || [];
    const tlHTML = STEPS.map((step, i) => {
      const ev     = tl.find(t2 => t2.status === step);
      const isDone = !!ev;
      const dotCls = isDone ? 'done' : (d.status === step ? 'current' : '');
      const linCls = isDone ? 'done' : '';
      return `
        <div class="timeline-step">
          <div class="timeline-dot ${dotCls}"></div>
          <div class="tl-label">${t(DELIVERY_STATUS_KEY[step] || step)}</div>
          ${ev ? `<div class="tl-time">${formatTime(ev.timestamp)}</div>` : ''}
        </div>
        ${i < STEPS.length - 1 ? `<div class="timeline-line ${linCls}"></div>` : ''}`;
    }).join('');

    const stCls = `ds-${d.status || 'dispatched'}`;
    const card  = document.createElement('div');
    card.className = 'delivery-card';
    card.innerHTML = `
      <div class="delivery-card-header">
        <span class="delivery-code">${d.order_code || '—'}</span>
        <span class="delivery-vendor">${d.vendor_name || '—'}</span>
        <span class="delivery-status-badge ${stCls}">${t(DELIVERY_STATUS_KEY[d.status] || d.status)}</span>
      </div>
      <div class="delivery-addresses">
        <div class="addr-box"><div class="addr-label">${t('delivery_pickup')}</div><div class="addr-val">${d.pickup_address || '—'}</div></div>
        <div class="addr-box"><div class="addr-label">${t('delivery_dropoff')}</div><div class="addr-val">${d.dropoff_address || '—'}</div></div>
      </div>
      <div class="delivery-timeline">${tlHTML}</div>`;
    list.appendChild(card);
  });
}

function renderShiftsTab(shifts) {
  const tbody = document.getElementById('shiftsTableBody');
  if (!shifts?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-data">${t('no_shifts')}</td></tr>`;
    return;
  }
  const sorted = [...shifts].sort((a, b) => new Date(b.start) - new Date(a.start));
  const now    = new Date();
  tbody.innerHTML = sorted.map(s => {
    const sd = new Date(s.start), ed = new Date(s.end);
    const isActive = sd <= now && ed >= now;
    const stateLabel = t(SHIFT_STATE_KEY[s.state] || s.state);
    return `
      <tr class="${isActive ? 'active-shift' : ''}">
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${s.id}</td>
        <td>${formatDateTime(s.start)}</td>
        <td>${formatTime(s.end)}</td>
        <td style="font-family:var(--font-main)">${s.starting_point_name || '—'}</td>
        <td><span class="shift-state-badge state-${s.state}">${stateLabel}${isActive ? ' 🟢' : ''}</span></td>
        <td>${shiftDuration(s.start, s.end)}</td>
      </tr>`;
  }).join('');
}

function renderPerformanceTab(rider) {
  const perf  = rider.performance  || {};
  const time  = perf.time_spent    || {};
  const circ  = 251.2;

  const util  = Math.min(Math.round((perf.utilization_rate || 0) * 100), 100);
  const utilEl = document.getElementById('utilCircleFill');
  if (utilEl) utilEl.setAttribute('stroke-dashoffset', (circ - circ * util / 100).toFixed(1));
  setText('perfUtilVal', `${util}%`);

  const acc   = Math.round((perf.acceptance_rate || 0) * 100);
  const accEl = document.getElementById('accCircleFill');
  if (accEl) accEl.setAttribute('stroke-dashoffset', (circ - circ * acc / 100).toFixed(1));
  setText('perfAccVal', `${acc}%`);

  setText('ts-worked', formatSeconds(time.worked_seconds));
  setText('ts-late',   formatSeconds(time.late_seconds));
  setText('ts-break',  formatSeconds(time.break_seconds));
  setText('ts-breaks', time.number_of_breaks || '0');
}

// ── TAB SWITCHING ──────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.detail-tab').forEach(t2 =>
    t2.classList.toggle('active', t2.dataset.tab === name)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${name}`)
  );
}

// ── GROUP BY STARTING POINT ────────────────────────────

function renderGroupByPoint() {
  const container = document.getElementById('groupByPointContent');
  if (!container) return;

  const stats   = computeStatsFromRiders(allRiders);
  const entries = Object.entries(stats.byPoint).sort((a, b) => b[1].total - a[1].total);

  if (!entries.length) {
    container.innerHTML = `<div class="no-data">${t('group_no_data')}</div>`;
    return;
  }

  container.innerHTML = entries.map(([ptName, data]) => `
    <div class="point-group-card">
      <div class="point-group-header">
        <span class="point-group-icon">📍</span>
        <span class="point-group-name">${ptName}</span>
        <span class="point-group-total">${data.total} ${t('map_driver')}</span>
      </div>
      <div class="point-group-stats">
        <div class="pg-stat pg-working"><span>${data.working}</span><small>${t('pg_working')}</small></div>
        <div class="pg-stat pg-starting"><span>${data.starting}</span><small>${t('pg_starting')}</small></div>
        <div class="pg-stat pg-break"><span>${data.break}</span><small>${t('pg_break')}</small></div>
        <div class="pg-stat pg-late"><span>${data.late}</span><small>${t('pg_late')}</small></div>
        <div class="pg-stat pg-orders"><span>${data.withOrders}</span><small>${t('pg_orders')}</small></div>
      </div>
      <div class="point-group-riders">
        ${allRiders
          .filter(r => (r.starting_point?.name || 'غير محدد') === ptName)
          .map(r => {
            const late2  = isLate(r);
            const hasOrd = hasActiveOrder(r);
            const dispN  = getRiderDisplayName(r);
            return `<span class="pg-rider-chip ${late2 ? 'chip-late' : ''}" title="${dispN}">
              ${hasOrd ? '🟢' : '⚪'} ${dispN.split(' ')[0]}
            </span>`;
          }).join('')}
      </div>
    </div>
  `).join('');
}

// ── PAGE NAVIGATION ────────────────────────────────────

function showWalletPage() {
  currentPage = 'wallet';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('walletPage').style.display    = 'flex';
  document.getElementById('mapPage').style.display       = 'none';
  if (document.getElementById('historyPage'))    document.getElementById('historyPage').style.display    = 'none';
  if (document.getElementById('substitutesPage')) document.getElementById('substitutesPage').style.display = 'none';
  renderWalletReport();
  updateNavButtons();
}

function showDashboardPage() {
  currentPage = 'dashboard';
  document.getElementById('dashboardPage').style.display = 'flex';
  document.getElementById('walletPage').style.display    = 'none';
  document.getElementById('mapPage').style.display       = 'none';
  if (document.getElementById('historyPage'))    document.getElementById('historyPage').style.display    = 'none';
  if (document.getElementById('substitutesPage')) document.getElementById('substitutesPage').style.display = 'none';
  updateNavButtons();
}

function showMapPage() {
  currentPage = 'map';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('walletPage').style.display    = 'none';
  document.getElementById('mapPage').style.display       = 'flex';
  if (document.getElementById('historyPage'))    document.getElementById('historyPage').style.display    = 'none';
  if (document.getElementById('substitutesPage')) document.getElementById('substitutesPage').style.display = 'none';
  updateNavButtons();
  requestAnimationFrame(() => requestAnimationFrame(() => initMap()));
}

function showHistoryPage() {
  currentPage = 'history';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('walletPage').style.display    = 'none';
  document.getElementById('mapPage').style.display       = 'none';
  if (document.getElementById('historyPage'))    document.getElementById('historyPage').style.display    = 'flex';
  if (document.getElementById('substitutesPage')) document.getElementById('substitutesPage').style.display = 'none';
  updateNavButtons();

  if (!document.getElementById('historyDateInput').value) {
    document.getElementById('historyDateInput').value = new Date().toLocaleDateString('en-CA');
  }

  loadHistoryStats();
}

function showSubstitutesPage() {
  currentPage = 'substitutes';
  document.getElementById('dashboardPage').style.display  = 'none';
  document.getElementById('walletPage').style.display     = 'none';
  document.getElementById('mapPage').style.display        = 'none';
  if (document.getElementById('historyPage'))    document.getElementById('historyPage').style.display    = 'none';
  if (document.getElementById('substitutesPage')) document.getElementById('substitutesPage').style.display = 'flex';
  updateNavButtons();
  loadSubstitutesPage();
}

function updateNavButtons() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.page === currentPage)
  );
}

// ── BACKGROUND JOB ─────────────────────────────────────

function shouldSendRider(rider) {
  const reason = rider.status_metadata?.reason;

  // ❌ لو logout → تجاهل
  if (reason === "Issue::CourierLogoutFromAllDevices") {
    return false;
  }

  return true;
}

async function sendRiderStatsJob() {
  if (!allRiders || !allRiders.length || !currentCompanyId) return;

  const today = new Date().toLocaleDateString('en-CA');
  const nowMs = Date.now();

  const payload = allRiders
    .filter(shouldSendRider)
    .map(r => {
      let workedSeconds = r.performance?.time_spent?.worked_seconds || 0;

      // ✅ FIX: If rider is currently on break, the API's worked_seconds
      // may still be counting. Freeze it by subtracting the ongoing break
      // duration that hasn't been closed yet.
      // The API gives us break_seconds (completed breaks only).
      // worked_seconds = total_elapsed - completed_breaks
      // But the CURRENT break hasn't been subtracted yet.
      // So we subtract: total_elapsed - worked_seconds - break_seconds
      // which equals the ongoing active break duration.
      if (r.status === 'break') {
        const shiftStartMs = r.active_shift_started_at
          ? new Date(r.active_shift_started_at).getTime()
          : null;

        if (shiftStartMs) {
          const totalElapsed    = Math.floor((nowMs - shiftStartMs) / 1000);
          const completedBreaks = r.performance?.time_spent?.break_seconds || 0;
          const ongoingBreak    = totalElapsed - workedSeconds - completedBreaks;

          if (ongoingBreak > 0) {
            workedSeconds = Math.max(0, workedSeconds - ongoingBreak);
          }
        }
      }

      const midnightMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const secondsSinceMidnight = Math.max(0, (nowMs - midnightMs) / 1000);
      const todayWorkedSeconds = Math.min(workedSeconds, secondsSinceMidnight);

      return {
        riderId:      String(r.employee_id || ''),
        riderName:    String(r.name || ''),
        companyId:    String(currentCompanyId),
        date:         today,
        wallet:       r.wallet_info?.balance || 0,
        orders:       r.deliveries_info?.completed_deliveries_count || 0,
        workingHours: todayWorkedSeconds / 3600
      };
    });

  if (!payload.length) return;

  console.log('Sending rider stats to backend:', payload);

  try {
    await fetch('https://express-extension-manager.premiumasp.net/api/rider-stats', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('sendRiderStatsJob error:', e);
  }
}

// ── HISTORY REPORT ─────────────────────────────────────

async function loadHistoryStats() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const date = document.getElementById('historyDateInput').value || new Date().toLocaleDateString('en-CA');
  const cid = currentCompanyId;

  if (!cid) {
    tbody.innerHTML = `<tr><td colspan="7" class="no-data" style="color:var(--text-muted)">لم يتم تحديد الشركة بعد. انتظر تحميل لوحة التحكم أولاً.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="7" class="no-data">${t('loading')}</td></tr>`;

  try {
    const res = await fetch(`https://express-extension-manager.premiumasp.net/api/rider-stats/${cid}/${date}`);
    if (!res.ok) throw new Error('API Error');
    historyRawData = await res.json();
    renderHistoryReport();
  } catch (err) {
    console.warn('loadHistoryStats error:', err);
    historyRawData = null;
    tbody.innerHTML = `<tr><td colspan="7" class="no-data" style="color:var(--red)">لا توجد بيانات لهذا اليوم أو حدث خطأ في الاتصال</td></tr>`;
    setText('hist-total-riders', '—');
    setText('hist-total-orders', '—');
    setText('hist-total-wallet', '—');
    setText('hist-total-hours', '—');
  }
}

function renderHistoryReport() {
  if (!historyRawData) return;

  setText('hist-total-riders', historyRawData.totalRiders ?? '—');
  setText('hist-total-orders', historyRawData.totalOrders ?? '—');
  setText('hist-total-wallet', historyRawData.totalWallet !== undefined ? historyRawData.totalWallet.toFixed(2) : '—');
  setText('hist-total-hours', historyRawData.totalWorkingHours !== undefined ? historyRawData.totalWorkingHours.toFixed(2) : '—');

  const tbody = document.getElementById('historyTableBody');
  let riders = historyRawData.riders || [];

  if (historySearchQuery) {
    const q = historySearchQuery.toLowerCase();
    riders = riders.filter(r => 
      (r.riderName || '').toLowerCase().includes(q) || 
      (String(r.riderId) || '').toLowerCase().includes(q)
    );
  }

  if (!riders.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="no-data">لا توجد بيانات</td></tr>`;
    return;
  }

  tbody.innerHTML = riders.map((r, i) => {
    const liveRider = allRiders.find(lr => String(lr.employee_id) === String(r.riderId));
    let statusLabel = t('hist_not_working');
    let badgeCls    = 'badge-offline';

    if (liveRider) {
      const st = effectiveStatus(liveRider);
      if (st !== 'offline') {
        const late = isLate(liveRider);
        statusLabel = late ? t('status_late') : (t(`status_${st}`) || st);
        badgeCls    = late ? 'badge-late' : (STATUS_BADGE[st] || 'badge-offline');
      }
    }

    const histDisplayName = riderNamesCache[String(r.riderId)] || r.riderName || '—';
    return `
    <tr>
      <td>${i + 1}</td>
      <td style="font-family:var(--font-main);font-weight:600">${histDisplayName}</td>
      <td style="font-family:var(--font-mono)">${r.riderId || '—'}</td>
      <td style="color:var(--amber);font-weight:700">${r.orders || 0}</td>
      <td style="color:var(--green);font-weight:700">${(r.wallet || 0).toFixed(2)} ${t('currency')}</td>
      <td style="color:var(--blue);font-weight:700">${(r.workingHours || 0).toFixed(2)} ${t('hour_label')}</td>
      <td><span class="badge ${badgeCls}">${statusLabel}</span></td>
    </tr>
    `;
  }).join('');
}

function downloadHistoryExcel() {
  if (!historyRawData || !historyRawData.riders || !historyRawData.riders.length) {
    toast(t('toast_no_export'), 'error');
    return;
  }

  let riders = historyRawData.riders;
  if (historySearchQuery) {
    const q = historySearchQuery.toLowerCase();
    riders = riders.filter(r => 
      (r.riderName || '').toLowerCase().includes(q) || 
      (String(r.riderId) || '').toLowerCase().includes(q)
    );
  }

  if (!riders.length) {
    toast(t('toast_no_export'), 'error');
    return;
  }

  const BOM = '\uFEFF';
  const headers = [
    t('hist_col_num'), t('hist_col_name'), t('hist_col_id'),
    t('hist_col_orders'), t('hist_col_wallet'), t('hist_col_hours'),
    t('hist_col_status')
  ];

  const rows = riders.map((r, i) => {
    const liveRider = allRiders.find(lr => String(lr.employee_id) === String(r.riderId));
    let statusLabel = t('hist_not_working');
    if (liveRider) {
      const st = effectiveStatus(liveRider);
      if (st !== 'offline') {
        const late = isLate(liveRider);
        statusLabel = late ? t('status_late') : (t(`status_${st}`) || st);
      }
    }

    const exportName = riderNamesCache[String(r.riderId)] || r.riderName || '';
    return [
      i + 1, exportName, r.riderId || '',
      r.orders || 0, (r.wallet || 0).toFixed(2),
      (r.workingHours || 0).toFixed(2), statusLabel
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv  = BOM + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const date = document.getElementById('historyDateInput').value || new Date().toLocaleDateString('en-CA');
  a.download = `history-report-${currentCompanyId}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(t('toast_exported'), 'success');
}

// ── WALLET REPORT ──────────────────────────────────────

function renderWalletReport() {
  const tbody = document.getElementById('walletTableBody');
  if (!tbody) return;

  const riders = [...allRiders].sort((a, b) => {
    const ba = a.wallet_info?.balance || 0;
    const bb = b.wallet_info?.balance || 0;
    return bb - ba;
  });

  if (!riders.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="no-data">${t('cp_no_data')}</td></tr>`;
    return;
  }

  tbody.innerHTML = riders.map((r, i) => {
    const wal = r.wallet_info || {};
    const bal = wal.balance;
    const ws  = walletStatus(wal.limit_status, bal);
    const statusClass = (bal >= 500) ? 'wallet-row-danger' : (bal >= 300) ? 'wallet-row-warn' : '';
    const balColor    = (bal >= 500) ? 'var(--red)' : (bal >= 300) ? 'var(--orange)' : 'var(--green)';

    return `
      <tr class="${statusClass}">
        <td>${i + 1}</td>
        <td style="font-family:var(--font-main);font-weight:600">${getRiderDisplayName(r)}</td>
        <td style="font-family:var(--font-mono);color:var(--text-muted)">${r.phone_number || '—'}</td>
        <td style="font-family:var(--font-main);color:var(--text-secondary)">${r.starting_point?.name || '—'}</td>
        <td style="font-family:var(--font-mono);font-weight:700;color:${balColor}">${bal !== undefined ? bal.toFixed(2) : '—'} ${t('currency')}</td>
        <td><span class="wallet-status ${ws.cls}">${ws.text}</span></td>
        <td style="font-family:var(--font-mono)">${r.employee_id}</td>
      </tr>`;
  }).join('');

  const overHard = riders.filter(r => (r.wallet_info?.balance || 0) >= 500).length;
  const overSoft = riders.filter(r => { const b = r.wallet_info?.balance || 0; return b >= 300 && b < 500; }).length;
  const ok       = riders.filter(r => (r.wallet_info?.balance || 0) < 300).length;

  setText('wallet-summary-hard', overHard);
  setText('wallet-summary-soft', overSoft);
  setText('wallet-summary-ok',   ok);
  setText('wallet-total-riders', riders.length);
}

// ── EXCEL DOWNLOAD ─────────────────────────────────────

function downloadWalletExcel() {
  if (!allRiders.length) { toast(t('toast_no_export'), 'error'); return; }

  const BOM     = '\uFEFF';
  const headers = [
    t('wallet_col_num'), t('wallet_col_name'), t('wallet_col_phone'),
    t('wallet_col_point'), `${t('wallet_col_balance')} (${t('currency')})`,
    t('wallet_col_status'), t('wallet_col_id'), t('shifts_status'),
  ];
  const rows = allRiders.map((r, i) => {
    const wal = r.wallet_info || {};
    const bal = wal.balance;
    const ws  = walletStatus(wal.limit_status, bal);
    return [
      i + 1, getRiderDisplayName(r), r.phone_number || '',
      r.starting_point?.name || '',
      bal !== undefined ? bal.toFixed(2) : '',
      ws.text, r.employee_id,
      t(`status_${effectiveStatus(r)}`) || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv  = BOM + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `wallet-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(t('toast_exported'), 'success');
}

// ── MAP ────────────────────────────────────────────────
/*
  Leaflet setup for Chrome Extension (Manifest V3):
  ─────────────────────────────────────────────────
  1. Download Leaflet from https://leafletjs.com/download.html
  2. Create a  libs/  folder inside your extension directory
  3. Place leaflet.js and leaflet.css inside  libs/
  4. Make sure manifest.json has web_accessible_resources covering libs/*
     (already done in the updated manifest.json)

  File structure should be:
    your-extension/
    ├── libs/
    │   ├── leaflet.js
    │   └── leaflet.css
    ├── dashboard.html
    ├── dashboard.js
    ├── dashboard.css
    └── manifest.json
*/

/* ── MAP TILE URL ─────────────────────────────────────
   CartoDB provides matching light and dark tile sets.
   dark_all  → used for dark theme
   light_all → used for light theme
   The tile URL is the ONLY thing that needs to change
   when the user toggles the theme.
   ─────────────────────────────────────────────────── */
function mapTileUrl() {
  if (currentTheme === 'light') {
    // CartoDB Voyager for light theme (better contrast, clearer lines and words)
    return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  } else {
    // CartoDB Dark Matter for dark theme
    return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  }
}

function loadLeafletThenInit(mapEl) {
  if (typeof L !== 'undefined') { buildMap(mapEl); return; }

  const localJs  = chrome?.runtime?.getURL
    ? chrome.runtime.getURL('libs/leaflet.js')
    : 'libs/leaflet.js';
  const localCss = chrome?.runtime?.getURL
    ? chrome.runtime.getURL('libs/leaflet.css')
    : 'libs/leaflet.css';

  // Inject CSS (local only)
  const link = document.createElement('link');
  link.rel   = 'stylesheet';
  link.href  = localCss;
  document.head.appendChild(link);

  // Inject JS (local only)
  const script    = document.createElement('script');
  script.src      = localJs;
  script.onload   = () => buildMap(mapEl);
  script.onerror  = () => showMapError(mapEl);
  document.head.appendChild(script);
}

function showMapError(mapEl) {
  mapEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:100%;color:var(--text-muted);gap:12px;font-size:13px;padding:40px;text-align:center">
      <div style="font-size:40px">🗺</div>
      <div style="font-size:15px;color:var(--text-primary);font-weight:700">${t('map_error')}</div>
      <div style="font-size:12px;color:var(--text-muted);max-width:360px;line-height:1.8">${t('map_error_sub')}</div>
      <code style="font-size:11px;background:var(--bg-card);padding:10px 16px;border-radius:6px;color:var(--amber);line-height:2">
        libs/leaflet.js<br>libs/leaflet.css
      </code>
    </div>`;
}

function initMap() {
  const mapEl = document.getElementById('liveMap');
  if (!mapEl) return;
  loadLeafletThenInit(mapEl);
}

function buildMap(mapEl) {
  if (leafletMap) {
    try { leafletMap.remove(); } catch (_) {}
    leafletMap    = null;
    mapTileLayer  = null;
  }

  leafletMap = L.map(mapEl, { zoomControl: true }).setView([21.3891, 39.8579], 11);

  // Store the tile layer reference so toggleTheme() can hot-swap it with setUrl()
  mapTileLayer = L.tileLayer(mapTileUrl(), {
    attribution: '© OpenStreetMap © CARTO',
    subdomains:  'abcd',
    maxZoom:     19,
  }).addTo(leafletMap);

  setTimeout(() => leafletMap && leafletMap.invalidateSize(), 200);

  mapMarkers.forEach(m => { try { m.remove(); } catch (_) {} });
  mapMarkers = [];

  const activeRiders = allRiders.filter(r =>
    r.current_location?.latitude &&
    r.current_location?.longitude &&
    ['working', 'starting', 'break', 'late'].includes(effectiveStatus(r))
  );

  setText('map-rider-count',    activeRiders.length);
  const withOrders    = activeRiders.filter(r => hasActiveOrder(r)).length;
  const withoutOrders = activeRiders.length - withOrders;
  setText('map-with-orders',    withOrders);
  setText('map-without-orders', withoutOrders);

  activeRiders.forEach(rider => {
    const loc    = rider.current_location;
    const hasOrd = hasActiveOrder(rider);
    const late   = isLate(rider);
    const color  = late ? '#ef4444' : (hasOrd ? '#22c55e' : '#f59e0b');

    const icon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${color};border:3px solid rgba(255,255,255,0.8);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:900;color:#000;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;">
        ${hasOrd ? '📦' : '🛵'}
      </div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 16],
    });

    const popupContent = `
      <div dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Cairo,sans-serif;min-width:200px">
        <strong style="font-size:14px">${getRiderDisplayName(rider)}</strong><br>
        <span style="color:#94a3b8;font-size:12px">${rider.starting_point?.name || '—'}</span><br>
        <span style="color:${color};font-weight:700">${hasOrd ? '🟢 ' + t('map_with_orders') : '⚪ ' + t('map_without_orders')}</span><br>
        <span style="font-size:11px;color:#64748b">
          ${rider.deliveries_info?.completed_deliveries_count || 0} ${t('ds_completed')}
        </span>
      </div>`;

    const marker = L.marker([loc.latitude, loc.longitude], { icon })
      .addTo(leafletMap)
      .bindPopup(popupContent);
    mapMarkers.push(marker);
  });

  if (mapMarkers.length > 0) {
    try {
      const group = L.featureGroup(mapMarkers);
      leafletMap.fitBounds(group.getBounds().pad(0.1));
    } catch (_) {}
  }
}

// ── البدلاء PAGE LOGIC ───────────────────────────

async function loadSubstitutesPage() {
  const grid    = document.getElementById('subsGrid');
  const loading = document.getElementById('subsLoadingState');
  if (!grid || !loading) return;

  if (!currentCompanyId) {
    loading.style.display = 'flex';
    grid.style.display    = 'none';
    loading.innerHTML     = `<p style="color:var(--text-muted)">انتظر تحميل البيانات أولاً...</p>`;
    return;
  }

  loading.style.display = 'flex';
  loading.innerHTML     = `<div class="spinner"></div><p>${t('loading')}</p>`;
  grid.style.display    = 'none';

  try {
    const namesList = await fetchRiderNames(currentCompanyId);
    subsRawData = namesList;
    buildRiderNamesCache(namesList);
    renderSubstitutesGrid();
  } catch (e) {
    console.warn('loadSubstitutesPage error:', e);
    loading.innerHTML = `<p style="color:var(--red)">فشل تحميل البيانات</p>`;
  }
}

function renderSubstitutesGrid() {
  const grid    = document.getElementById('subsGrid');
  const loading = document.getElementById('subsLoadingState');
  if (!grid) return;

  loading.style.display = 'none';
  grid.style.display    = 'grid';

  let entries = subsRawData || [];

  if (subsSearchQuery) {
    const q = subsSearchQuery.toLowerCase();
    entries = entries.filter(e =>
      String(e.riderId).toLowerCase().includes(q) ||
      (e.overrideName || '').toLowerCase().includes(q) ||
      (() => {
        const live = allRiders.find(r => String(r.employee_id) === String(e.riderId));
        return live ? cleanName(live.name).toLowerCase().includes(q) : false;
      })()
    );
  }

  const overriddenCount = (subsRawData || []).filter(e => e.overrideName).length;
  setText('sub-total',      subsRawData.length);
  setText('sub-overridden', overriddenCount);

  if (!entries.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">${t('no_data')}</div>`;
    return;
  }

  grid.innerHTML = entries.map(entry => {
    const liveRider   = allRiders.find(r => String(r.employee_id) === String(entry.riderId));
    const originalName = liveRider ? cleanName(liveRider.name) : `#${entry.riderId}`;
    const currentOverride = entry.overrideName || '';
    const hasOverride = !!currentOverride;
    const safeId = String(entry.riderId).replace(/[^a-zA-Z0-9_-]/g, '_');

    return `
      <div class="sub-card ${hasOverride ? 'sub-card-overridden' : ''}" id="subcard-${safeId}">
        <div class="sub-card-header">
          <div class="sub-rider-id">#${entry.riderId}</div>
          ${hasOverride ? '<span class="sub-badge-custom">✅ مخصص</span>' : '<span class="sub-badge-original">أصلي</span>'}
        </div>
        <div class="sub-name-row">
          <div class="sub-name-label">${t('sub_original_name')}</div>
          <div class="sub-name-original">${originalName}</div>
        </div>
        <div class="sub-name-row">
          <div class="sub-name-label">${t('sub_custom_name')}</div>
          <div class="sub-name-display">${hasOverride ? currentOverride : '<span style="color:var(--text-muted);font-style:italic">— لا يوجد —</span>'}</div>
        </div>
        <div class="sub-input-row">
          <input
            type="text"
            class="sub-input"
            id="subinput-${safeId}"
            placeholder="${t('sub_edit_placeholder')}"
            value="${currentOverride.replace(/"/g, '&quot;')}"
          />
          <button class="sub-btn-save" data-action="save" data-rider-id="${entry.riderId}" data-safe-id="${safeId}">${t('sub_save')}</button>
          ${hasOverride ? `<button class="sub-btn-clear" data-action="clear" data-rider-id="${entry.riderId}" data-safe-id="${safeId}">&#10005;</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  // Listeners handled by the permanent delegated handler on subsGrid (see DOMContentLoaded)
}

function _subsGridClickHandler(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const riderId = btn.dataset.riderId;
  const safeId  = btn.dataset.safeId;
  if (btn.dataset.action === 'save')  _doSubSave(riderId, safeId);
  if (btn.dataset.action === 'clear') _doSubClear(riderId, safeId);
}

async function _doSubSave(riderId, safeId) {
  const input = document.getElementById(`subinput-${safeId}`);
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) { toast(t('sub_error') + ': الاسم فارغ', 'error'); return; }
  if (!currentCompanyId) { toast(t('sub_error'), 'error'); return; }

  const btn = input.nextElementSibling;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    await putRiderName(currentCompanyId, riderId, newName);
    riderNamesCache[String(riderId)] = newName;
    const entry = (subsRawData || []).find(e => String(e.riderId) === String(riderId));
    if (entry) entry.overrideName = newName;
    else subsRawData.push({ riderId, companyId: currentCompanyId, overrideName: newName });
    toast(t('sub_saved'), 'success');
    renderSubstitutesGrid();
    applyFiltersAndSort();
  } catch (e) {
    console.warn('_doSubSave error:', e);
    toast(t('sub_error'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = t('sub_save'); }
  }
}

async function _doSubClear(riderId, safeId) {
  if (!currentCompanyId) { toast(t('sub_error'), 'error'); return; }
  try {
    await putRiderName(currentCompanyId, riderId, '');
    riderNamesCache[String(riderId)] = null;
    const entry = (subsRawData || []).find(e => String(e.riderId) === String(riderId));
    if (entry) entry.overrideName = null;
    toast(t('sub_cleared'), 'info');
    renderSubstitutesGrid();
    applyFiltersAndSort();
  } catch (e) {
    console.warn('_doSubClear error:', e);
    toast(t('sub_error'), 'error');
  }
}

// ── AUTO REFRESH ───────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    loadRiders(true);
    if (currentPage === 'map' && leafletMap) buildMap(document.getElementById('liveMap'));
    if (currentPage === 'wallet') renderWalletReport();
    if (selectedRiderId) {
      fetchRiderDetails(selectedRiderId).then(rider => {
        renderRiderHeader(rider);
        renderOverviewTab(rider);
        renderDeliveriesTab(rider);
        renderPerformanceTab(rider);
      }).catch(() => {});
    }
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

// ── INIT ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  applyTheme();

  // ── Populate city dropdown ──────────────────────────
  const citySelect = document.getElementById('citySelect');
  if (citySelect) {
    CITIES.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city.id;
      opt.textContent = cityName(city);
      // Default to Jeddah (id=6)
      if (city.id === 6) opt.selected = true;
      citySelect.appendChild(opt);
    });

    citySelect.addEventListener('change', () => {
      const selected = CITIES.find(c => c.id === Number(citySelect.value));
      if (selected) {
        currentCityEntry  = selected;
        currentCompanyId  = null;
        previousStatuses  = {}; // reset status tracking for new city
        selectedRiderId   = null;
        allRiders         = [];
        filteredRiders    = [];
        document.getElementById('riderDetail').style.display = 'none';
        document.getElementById('emptyState').style.display  = 'flex';
        loadRiders();
      }
    });
  }

  applyLanguage();

  loadRiders();

  document.getElementById('btnTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnLang')?.addEventListener('click', toggleLang);

  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadRiders();
    if (currentPage === 'map') buildMap(document.getElementById('liveMap'));
    if (currentPage === 'wallet') renderWalletReport();
    if (selectedRiderId) selectRider(selectedRiderId);
  });

  const toggle = document.getElementById('autoRefreshToggle');
  toggle.addEventListener('change', () => {
    if (toggle.checked) { startAutoRefresh(); toast(t('toast_auto_on'), 'info'); }
    else                { stopAutoRefresh();  toast(t('toast_auto_off'), 'info'); }
  });
  if (toggle.checked) startAutoRefresh();

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.style.display = searchQuery ? 'block' : 'none';
    applyFiltersAndSort();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    applyFiltersAndSort();
  });

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      applyFiltersAndSort();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', e => {
    sortBy = e.target.value;
    applyFiltersAndSort();
  });

  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
      if (tab.dataset.tab === 'groupbypoint') renderGroupByPoint();
    });
  });

  document.getElementById('closeDetail').addEventListener('click', () => {
    selectedRiderId = null;
    document.getElementById('riderDetail').style.display = 'none';
    document.getElementById('emptyState').style.display  = 'flex';
    document.querySelectorAll('.rider-card').forEach(c => c.classList.remove('selected'));
  });

  document.getElementById('navDashboard').addEventListener('click', showDashboardPage);
  document.getElementById('navWallet').addEventListener('click', showWalletPage);
  document.getElementById('navMap').addEventListener('click', showMapPage);
  if (document.getElementById('navHistory')) {
    document.getElementById('navHistory').addEventListener('click', showHistoryPage);
  }
  if (document.getElementById('navSubstitutes')) {
    document.getElementById('navSubstitutes').addEventListener('click', showSubstitutesPage);
  }
  if (document.getElementById('btnRefreshSubs')) {
    document.getElementById('btnRefreshSubs').addEventListener('click', loadSubstitutesPage);
  }
  if (document.getElementById('subsSearchInput')) {
    document.getElementById('subsSearchInput').addEventListener('input', e => {
      subsSearchQuery = e.target.value.trim();
      renderSubstitutesGrid();
    });
  }

  // Permanent delegated listener for البدلاء grid buttons (survives re-renders)
  const subsGrid = document.getElementById('subsGrid');
  if (subsGrid) subsGrid.addEventListener('click', _subsGridClickHandler);
  if (document.getElementById('btnRefreshHistory')) {
    document.getElementById('btnRefreshHistory').addEventListener('click', loadHistoryStats);
  }
  if (document.getElementById('historyDateInput')) {
    document.getElementById('historyDateInput').addEventListener('change', loadHistoryStats);
  }
  if (document.getElementById('historySearchInput')) {
    const hsInput = document.getElementById('historySearchInput');
    hsInput.addEventListener('input', () => {
      historySearchQuery = hsInput.value.trim();
      renderHistoryReport();
    });
  }
  if (document.getElementById('btnExportHistory')) {
    document.getElementById('btnExportHistory').addEventListener('click', downloadHistoryExcel);
  }

  document.getElementById('btnExportWallet')?.addEventListener('click', downloadWalletExcel);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); loadRiders(); }
    if (e.key === 'Escape') document.getElementById('closeDetail').click();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
});