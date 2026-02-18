export type Language = 'en' | 'hi' | 'mr';

export type TranslationKey =
    // Common
    | 'welcome_back'
    | 'last_login'
    | 'ago'
    | 'just_now'
    | 'first_login'
    | 'dashboard_title'
    | 'select_language'
    | 'loading'
    | 'failed_load'
    | 'try_again'
    | 'no_data'
    | 'view_all'
    | 'download'
    | 'view'
    | 'collapse'
    | 'expand'
    | 'test'
    | 'value'
    | 'range'
    | 'status'
    | 'trend'
    | 'date'
    | 'files'
    | 'none'
    | 'reports'
    | 'download_report'
    | 'download_pdf'
    | 'refresh'

    // Sidebar
    | 'sidebar_dashboard'
    | 'sidebar_patient_card'
    | 'sidebar_profile'
    | 'sidebar_medical_records'
    | 'sidebar_conditions'
    | 'sidebar_prescriptions'
    | 'sidebar_medicines'
    | 'sidebar_adherence'
    | 'sidebar_alerts'
    | 'sidebar_downloads'
    | 'sidebar_security'
    | 'sidebar_logout'
    | 'health_system'

    // KPI Grid
    | 'kpi_medical_records'
    | 'kpi_active_prescriptions'
    | 'kpi_pending_labs'
    | 'kpi_adherence_rate'
    | 'kpi_health_alerts'
    | 'kpi_downloads'

    // Recent Records
    | 'recent_records_title'
    | 'diagnosis'
    | 'tests_performed'
    | 'prescription'
    | 'doctor_notes'
    | 'status_completed'
    | 'status_follow_up'
    | 'status_critical'
    | 'empty_records'
    | 'empty_records_desc'
    | 'no_reports'

    // Lab Monitoring
    | 'lab_title'
    | 'lab_subtitle'
    | 'lab_high'
    | 'lab_low'
    | 'lab_normal'
    | 'empty_labs'
    | 'empty_labs_desc'
    | 'no_report_available'

    // Health Trends
    | 'trends_title'
    | 'trends_subtitle'
    | 'systolic'
    | 'diastolic'
    | 'reading_s'
    | 'empty_trends'
    | 'empty_trends_desc'
    | 'no_data_period'

    // Alerts Panel
    | 'alerts_title'
    | 'alerts_subtitle'
    | 'alert_lab_results'
    | 'alert_adherence'
    | 'alert_risk_score'
    | 'mark_read'
    | 'dismiss'
    | 'all_clear'
    | 'all_clear_desc'

    // Current Diseases
    | 'conditions_title'
    | 'chronic_conditions'
    | 'blood_pressure'
    | 'blood_sugar'
    | 'last_recorded'
    | 'no_active_conditions'
    | 'no_bp_readings'
    | 'no_sugar_readings'

    // Dashboard Metrics & Misc
    | 'risk_score'
    | 'active_alerts'
    | 'adherence'
    | 'high'
    | 'medium'
    | 'low'
    | 'risk'

    // Prescriptions Card
    | 'active_prescriptions_title'
    | 'medicines_count'
    | 'issued'
    | 'dispensed'
    | 'pending'
    | 'no_prescriptions';

export const translations: Record<Language, Record<TranslationKey, string>> = {
    en: {
        // Common
        welcome_back: 'Welcome back',
        last_login: 'Last login',
        ago: 'ago',
        just_now: 'Just now',
        first_login: 'First login',
        dashboard_title: 'Health Surveillance Dashboard',
        select_language: 'Select Language',
        loading: 'Loading...',
        failed_load: 'Failed to load data',
        try_again: 'Please try again later',
        no_data: 'No data available',
        view_all: 'View All',
        download: 'Download',
        view: 'View',
        collapse: 'Collapse',
        expand: 'Expand',
        test: 'Test',
        value: 'Value',
        range: 'Range',
        status: 'Status',
        trend: 'Trend',
        date: 'Date',
        files: 'file(s)',
        none: 'None',
        reports: 'Reports',
        download_report: 'Download Report',
        download_pdf: 'Download PDF',
        refresh: 'Refresh',

        // Sidebar
        sidebar_dashboard: 'Dashboard',
        sidebar_patient_card: 'Patient Card',
        sidebar_profile: 'My Profile',
        sidebar_medical_records: 'Medical Records',
        sidebar_conditions: 'My Conditions',
        sidebar_prescriptions: 'Prescriptions',
        sidebar_medicines: 'Medicines',
        sidebar_adherence: 'Adherence',
        sidebar_alerts: 'Alerts',
        sidebar_downloads: 'Downloads',
        sidebar_security: 'Security',
        sidebar_logout: 'Logout',
        health_system: 'Health System',

        // KPI Grid
        kpi_medical_records: 'Medical Records',
        kpi_active_prescriptions: 'Active Prescriptions',
        kpi_pending_labs: 'Pending Lab Reports',
        kpi_adherence_rate: 'Adherence Rate',
        kpi_health_alerts: 'Health Alerts',
        kpi_downloads: 'Report Downloads',

        // Recent Records
        recent_records_title: 'Recent Medical Records',
        diagnosis: 'Diagnosis',
        tests_performed: 'Tests Performed',
        prescription: 'Prescription',
        doctor_notes: 'Doctor Notes',
        status_completed: 'Completed',
        status_follow_up: 'Follow-up',
        status_critical: 'Critical',
        empty_records: 'No medical records yet',
        empty_records_desc: 'Your visit records will appear here',
        no_reports: 'No reports uploaded for this visit',

        // Lab Monitoring
        lab_title: 'Lab & Test Monitoring',
        lab_subtitle: 'Latest results with normal ranges',
        lab_high: 'High',
        lab_low: 'Low',
        lab_normal: 'Normal',
        empty_labs: 'No lab results yet',
        empty_labs_desc: 'Your lab test results will appear here once available.',
        no_report_available: 'No report available',

        // Health Trends
        trends_title: 'Health Trends',
        trends_subtitle: 'Track your vitals over time',
        systolic: 'Systolic',
        diastolic: 'Diastolic',
        reading_s: 'reading(s)',
        empty_trends: 'No health data yet',
        empty_trends_desc: 'Your vital readings will appear here once recorded.',
        no_data_period: 'No data for this period',

        // Alerts Panel
        alerts_title: 'Alerts & Risk Monitoring',
        alerts_subtitle: 'Health alerts based on your data',
        alert_lab_results: 'Lab Results',
        alert_adherence: 'Adherence',
        alert_risk_score: 'Risk Score',
        mark_read: 'Mark as read',
        dismiss: 'Dismiss',
        all_clear: 'All Clear',
        all_clear_desc: 'No active health alerts. Keep up the good work!',

        // Current Diseases
        conditions_title: 'Current Health Status',
        chronic_conditions: 'Chronic Conditions',
        blood_pressure: 'Blood Pressure',
        blood_sugar: 'Blood Sugar',
        last_recorded: 'Last recorded',
        no_active_conditions: 'No active chronic conditions recorded.',
        no_bp_readings: 'No BP readings recently.',
        no_sugar_readings: 'No blood sugar readings recently.',

        // Dashboard Metrics & Misc
        risk_score: 'Risk Score',
        active_alerts: 'Active Alerts',
        adherence: 'Adherence',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        risk: 'Risk',

        // Prescriptions Card
        active_prescriptions_title: 'Active Prescriptions',
        medicines_count: 'medicine(s)',
        issued: 'Issued',
        dispensed: 'Dispensed',
        pending: 'Pending',
        no_prescriptions: 'No prescriptions yet'
    },
    hi: {
        // Common
        welcome_back: 'वापसी पर स्वागत है',
        last_login: 'पिछला लॉगिन',
        ago: 'पहले',
        just_now: 'अभी अभी',
        first_login: 'पहला लॉगिन',
        dashboard_title: 'स्वास्थ्य निगरानी डैशबोर्ड',
        select_language: 'भाषा चुनें',
        loading: 'लोड हो रहा है...',
        failed_load: 'डेटा लोड करने में विफल',
        try_again: 'कृपया बाद में पुन: प्रयास करें',
        no_data: 'कोई डेटा उपलब्ध नहीं है',
        view_all: 'सभी देखें',
        download: 'डाउनलोड',
        view: 'देंखे',
        collapse: 'संक्षिप्त करें',
        expand: 'विस्तार करें',
        test: 'परीक्षण',
        value: 'मूल्य',
        range: 'श्रेणी',
        status: 'स्थिति',
        trend: 'रुझान',
        date: 'दिनांक',
        files: 'फ़ाइल(ें)',
        none: 'कोई नहीं',
        reports: 'रिपोर्ट',
        download_report: 'रिपोर्ट डाउनलोड करें',
        download_pdf: 'पीडीएफ डाउनलोड करें',
        refresh: 'ताज़ा करें',

        // Sidebar
        sidebar_dashboard: 'डैशबोर्ड',
        sidebar_patient_card: 'रोगी कार्ड',
        sidebar_profile: 'मेरी प्रोफ़ाइल',
        sidebar_medical_records: 'चिकित्सा रिकॉर्ड',
        sidebar_conditions: 'मेरी स्थितियाँ',
        sidebar_prescriptions: 'नुस्खे',
        sidebar_medicines: 'दवाइयाँ',
        sidebar_adherence: 'अनुपालन',
        sidebar_alerts: 'चेतावनी',
        sidebar_downloads: 'डाउनलोड',
        sidebar_security: 'सुरक्षा',
        sidebar_logout: 'लॉग आउट',
        health_system: 'स्वास्थ्य प्रणाली',

        // KPI Grid
        kpi_medical_records: 'चिकित्सा रिकॉर्ड',
        kpi_active_prescriptions: 'सक्रिय नुस्खे',
        kpi_pending_labs: 'लंबित लैब रिपोर्ट',
        kpi_adherence_rate: 'अनुपालन दर',
        kpi_health_alerts: 'स्वास्थ्य चेतावनी',
        kpi_downloads: 'रिपोर्ट डाउनलोड',

        // Recent Records
        recent_records_title: 'हाल के चिकित्सा रिकॉर्ड',
        diagnosis: 'निदान',
        tests_performed: 'किए गए परीक्षण',
        prescription: 'नुस्खा',
        doctor_notes: 'डॉक्टर के नोटिस',
        status_completed: 'पूर्ण',
        status_follow_up: 'अनुवर्ती',
        status_critical: 'गंभीर',
        empty_records: 'अभी तक कोई चिकित्सा रिकॉर्ड नहीं',
        empty_records_desc: 'आपके दौरे के रिकॉर्ड यहां दिखाई देंगे',
        no_reports: 'इस यात्रा के लिए कोई रिपोर्ट अपलोड नहीं की गई',

        // Lab Monitoring
        lab_title: 'लैब और परीक्षण निगरानी',
        lab_subtitle: 'सामान्य श्रेणियों के साथ नवीनतम परिणाम',
        lab_high: 'उच्च',
        lab_low: 'कम',
        lab_normal: 'सामान्य',
        empty_labs: 'अभी तक कोई लैब परिणाम नहीं',
        empty_labs_desc: 'उपलब्ध होने पर आपके लैब परीक्षण परिणाम यहां दिखाई देंगे।',
        no_report_available: 'कोई रिपोर्ट उपलब्ध नहीं',

        // Health Trends
        trends_title: 'स्वास्थ्य रुझान',
        trends_subtitle: 'समय के साथ अपने महत्वपूर्ण संकेतों को ट्रैक करें',
        systolic: 'सिस्टोलिक',
        diastolic: 'डायस्टोलिक',
        reading_s: 'reading(s)',
        empty_trends: 'अभी तक कोई स्वास्थ्य डेटा नहीं',
        empty_trends_desc: 'रिकॉर्ड किए जाने पर आपके महत्वपूर्ण संकेत यहां दिखाई देंगे।',
        no_data_period: 'इस अवधि के लिए कोई डेटा नहीं',

        // Alerts Panel
        alerts_title: 'चेतावनी और जोखिम निगरानी',
        alerts_subtitle: 'आपके डेटा के आधार पर स्वास्थ्य अलर्ट',
        alert_lab_results: 'लैब परिणाम',
        alert_adherence: 'अनुपालन',
        alert_risk_score: 'जोखिम स्कोर',
        mark_read: 'पढ़ा हुआ चिह्नित करें',
        dismiss: 'खारिज करें',
        all_clear: 'सब ठीक है',
        all_clear_desc: 'कोई सक्रिय स्वास्थ्य अलर्ट नहीं. अच्छा काम करते रहें!',

        // Current Diseases
        conditions_title: 'वर्तमान स्वास्थ्य स्थिति',
        chronic_conditions: 'दीर्घकालिक स्थितियाँ',
        blood_pressure: 'रक्तचाप',
        blood_sugar: 'रक्त शर्करा',
        last_recorded: 'अंतिम रिकॉर्ड किया गया',
        no_active_conditions: 'कोई सक्रिय दीर्घकालिक स्थिति दर्ज नहीं की गई।',
        no_bp_readings: 'हाल ही में कोई बीपी रीडिंग नहीं।',
        no_sugar_readings: 'हाल ही में कोई रक्त शर्करा रीडिंग नहीं।',

        // Dashboard Metrics & Misc
        risk_score: 'जोखिम स्कोर',
        active_alerts: 'सक्रिय चेतावनियाँ',
        adherence: 'पालन',
        high: 'उच्च',
        medium: 'मध्यम',
        low: 'कम',
        risk: 'जोखिम',

        // Prescriptions Card
        active_prescriptions_title: 'सक्रिय नुस्खे',
        medicines_count: 'दवा(इयाँ)',
        issued: 'जारी किया गया',
        dispensed: 'वितरित',
        pending: 'लंबित',
        no_prescriptions: 'अभी तक कोई नुस्खे नहीं'
    },
    mr: {
        // Common
        welcome_back: 'परत स्वागत आहे',
        last_login: 'शेवटचे लॉगिन',
        ago: 'पूर्वी',
        just_now: 'आत्ताच',
        first_login: 'पहिले लॉगिन',
        dashboard_title: 'आरोग्य देखरेख डॅशबोर्ड',
        select_language: 'भाषा निवडा',
        loading: 'लोड होत आहे...',
        failed_load: 'डेटा लोड करण्यात अयशस्वी',
        try_again: 'कृपया नंतर पुन्हा प्रयत्न करा',
        no_data: 'कोणताही डेटा उपलब्ध नाही',
        view_all: 'सर्व पहा',
        download: 'डाउनलोड',
        view: 'पहा',
        collapse: 'लहान करा',
        expand: 'विस्तृत करा',
        test: 'चाचणी',
        value: 'मूल्य',
        range: 'श्रेणी',
        status: ' स्थिती',
        trend: 'प्रवृत्ती',
        date: 'तारीख',
        files: 'फाईल(्स)',
        none: 'काहीही नाही',
        reports: 'अहवाल',
        download_report: 'अहवाल डाउनलोड करा',
        download_pdf: 'PDF डाउनलोड करा',
        refresh: 'रीफ्रेश',

        // Sidebar
        sidebar_dashboard: 'डॅशबोर्ड',
        sidebar_patient_card: 'रुग्ण कार्ड',
        sidebar_profile: 'माझी प्रोफाइल',
        sidebar_medical_records: 'वैद्यकीय नोंदी',
        sidebar_conditions: 'माझी स्थिती',
        sidebar_prescriptions: 'प्रिस्क्रिप्शन',
        sidebar_medicines: 'औषधे',
        sidebar_adherence: 'पालन',
        sidebar_alerts: 'सूचना',
        sidebar_downloads: 'डाउनलोड',
        sidebar_security: 'सुरक्षा',
        sidebar_logout: 'लॉग आउट',
        health_system: 'आरोग्य प्रणाली',

        // KPI Grid
        kpi_medical_records: 'वैद्यकीय नोंदी',
        kpi_active_prescriptions: 'सक्रिय प्रिस्क्रिप्शन',
        kpi_pending_labs: 'प्रलंबित लॅब अहवाल',
        kpi_adherence_rate: 'पालन दर',
        kpi_health_alerts: 'आरोग्य सूचना',
        kpi_downloads: 'अहवाल डाउनलोड',

        // Recent Records
        recent_records_title: 'अलीकडील वैद्यकीय नोंदी',
        diagnosis: 'निदान',
        tests_performed: 'केलेल्या चाचण्या',
        prescription: 'प्रिस्क्रिप्शन',
        doctor_notes: 'डॉ डॉक्टरांच्या नोंदी',
        status_completed: 'पूर्ण',
        status_follow_up: 'पाठपुरावा',
        status_critical: 'गंभीर',
        empty_records: 'अद्याप कोणत्याही वैद्यकीय नोंदी नाहीत',
        empty_records_desc: 'तुमच्या भेटीच्या नोंदी येथे दिसतील',
        no_reports: 'या भेटीसाठी कोणतेही अहवाल अपलोड केलेले नाहीत',

        // Lab Monitoring
        lab_title: 'लॅब आणि चाचणी देखरेख',
        lab_subtitle: 'सामान्य श्रेणींसह नवीनतम परिणाम',
        lab_high: 'उच्च',
        lab_low: 'कमी',
        lab_normal: 'सामान्य',
        empty_labs: 'अद्याप कोणतेही लॅब परिणाम नाहीत',
        empty_labs_desc: 'उपलब्ध झाल्यावर तुमचे लॅब चाचणी परिणाम येथे दिसतील.',
        no_report_available: 'कोणताही अहवाल उपलब्ध नाही',

        // Health Trends
        trends_title: 'आरोग्य ट्रेंड',
        trends_subtitle: 'कालांतराने आपल्या महत्त्वपूर्ण संकेतांचा मागोवा घ्या',
        systolic: 'सिस्टोलिक',
        diastolic: 'डायस्टोलिक',
        reading_s: 'वाचन',
        empty_trends: 'अद्याप कोणताही आरोग्य डेटा नाही',
        empty_trends_desc: 'रेकॉर्ड केल्यावर तुमचे महत्त्वपूर्ण संकेत येथे दिसतील.',
        no_data_period: 'या कालावधीसाठी डेटा नाही',

        // Alerts Panel
        alerts_title: 'सूचना आणि जोखीम देखरेख',
        alerts_subtitle: 'तुमच्या डेटावर आधारित आरोग्य सूचना',
        alert_lab_results: 'लॅब परिणाम',
        alert_adherence: 'पालन',
        alert_risk_score: 'धोका गुण',
        mark_read: 'वाचलेले म्हणून चिन्हांकित करा',
        dismiss: 'काढून टाका',
        all_clear: 'सर्व साफ',
        all_clear_desc: 'कोणत्याही सक्रिय आरोग्य सूचना नाहीत. चांगले काम सुरू ठेवा!',

        // Current Diseases
        conditions_title: 'सध्याची आरोग्य स्थिती',
        chronic_conditions: 'जुनाट आजार',
        blood_pressure: 'रक्तदाब',
        blood_sugar: 'रक्त शर्करा',
        last_recorded: 'शेवटचे रेकॉर्ड केलेले',
        no_active_conditions: 'कोणत्याही सक्रिय जुनाट आजाराची नोंद नाही.',
        no_bp_readings: 'अलीकडे बीपी वाचन नाही.',
        no_sugar_readings: 'अलीकडे कोणतीही रक्त शर्करा वाचन नाही.',

        // Dashboard Metrics & Misc
        risk_score: 'धोका गुण',
        active_alerts: 'सक्रिय सूचना',
        adherence: 'पालन',
        high: 'उच्च',
        medium: 'मध्यम',
        low: 'क कमी',
        risk: 'धोका',

        // Prescriptions Card
        active_prescriptions_title: 'सक्रिय प्रिस्क्रिप्शन',
        medicines_count: 'औषध(े)',
        issued: 'जारी केले',
        dispensed: 'वितरित',
        pending: 'प्रलंबित',
        no_prescriptions: 'अद्याप कोणतीही प्रिस्क्रिप्शन नाहीत'
    }
};
