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
    | 'no_prescriptions'

    // Medical Records Page
    | 'medical_records_page_title'
    | 'medical_records_page_subtitle'
    | 'allergies_title'
    | 'no_allergies'
    | 'consultation_history'
    | 'attached_reports'

    // Prescriptions Page
    | 'prescriptions_page_title'
    | 'prescriptions_page_subtitle'
    | 'prescription_file'
    | 'medicine_name'
    | 'dosage'
    | 'frequency'
    | 'duration'
    | 'quantity'
    | 'instructions'
    | 'dispense_status'

    // Doctor Dashboard
    | 'doctor_dashboard_title'
    | 'doctor_dashboard_subtitle'
    | 'scan_patient_qr'
    | 'total_assigned_patients'
    | 'high_risk_patients'
    | 'pending_lab_reviews'
    | 'recent_updates'
    | 'recent_activity'
    | 'view_high_risk'
    | 'no_high_risk_patients'
    | 'no_recent_activity'
    | 'patient_queue'
    | 'patients_seen_today'
    | 'pending_reports'

    // QR Scan Page
    | 'scan_qr_title'
    | 'scan_qr_subtitle'
    | 'camera_scanner'
    | 'camera_scanner_desc'
    | 'manual_entry'
    | 'manual_entry_desc'
    | 'universal_patient_id'
    | 'find_patient'
    | 'digital_token'
    | 'access_via_token'
    | 'camera_access_error'
    | 'camera_active'
    | 'start_camera'
    | 'stop_scanner'
    | 'patient_data_loaded'
    | 'clear_patient_data'
    | 'scan_another'
    | 'add_to_my_patients'
    | 'create_visit_record'
    | 'current_vitals'
    | 'medical_records_history'
    | 'recent_prescriptions'

    // High Risk Page
    | 'high_risk_title'
    | 'high_risk_subtitle'
    | 'flagged'
    | 'search_high_risk'
    | 'analysing_risk'
    | 'no_high_risk_found'
    | 'no_high_risk_desc'
    | 'primary_condition'
    | 'risk_factors'
    | 'abnormal_labs_count'
    | 'new_record'
    | 'view_history'
    | 'critical'
    | 'high_risk'
    | 'medium_risk'
    | 'low_risk'

    // My Patients Page
    | 'my_patients_title'
    | 'my_patients_subtitle'
    | 'total'
    | 'search_patients_placeholder'
    | 'loading_patients'
    | 'error_loading_patients'
    | 'no_patients_found'
    | 'adjust_search'
    | 'scan_qr_prompt'
    | 'scan_qr_now'
    | 'create_record'
    | 'history'

    // Add Record Page
    | 'add_record_title'
    | 'add_record_subtitle'
    | 'visit_details'
    | 'select_patient'
    | 'choose_patient'
    | 'visit_date'
    | 'upload_reports'
    | 'upload_reports_desc'
    | 'save_record'
    | 'saving'
    | 'record_saved_success'
    | 'record_saved_desc'
    | 'create_another'
    | 'click_upload'
    | 'add_more_files'

    // Patient Details Page
    | 'patient_history'
    | 'no_records_found'
    | 'create_new_record_short'
    | 'diagnosis_label'
    | 'treatment_label'
    | 'date_label'
    | 'doctor_label'
    | 'attachments'

    // Admin Dashboard
    | 'admin_dashboard_title'
    | 'admin_dashboard_subtitle'
    | 'refresh_data'
    | 'cases_today'
    | 'active_alerts_count'
    | 'active_clusters'
    | 'monitored_regions'
    | 'high_risk_regions'
    | 'unresolved_anomalies'
    | 'ml_pipeline_control'
    | 'ml_pipeline_desc'
    | 'run_pipeline'
    | 'pipeline_loading'
    | 'records_7d'
    | 'forecasts_today'
    | 'anomalies_7d'
    | 'risk_scores_today'
    | 'regions'
    | 'active_alerts_title'
    | 'confidence'
    | 'acknowledge'
    | 'disease_heat_map'
    | 'disease_heat_map_desc'
    | 'all_diseases'
    | 'reset_view'
    | 'no_heat_map_data'
    | 'disease_statistics'
    | 'no_disease_data'
    | 'case_forecasts'
    | 'forecast_days'
    | 'predictions'
    | 'avg_confidence'
    | 'no_forecast_data'
    | 'recent_anomalies'
    | 'anomaly_detection_desc'
    | 'actual'
    | 'expected'
    | 'no_anomalies'
    | 'regional_risk_scores'
    | 'risk_score_desc'
    | 'no_risk_scores'
    | 'trending_diseases'
    | 'trending_growth_desc'
    | 'no_trending_data'
    | 'regional_comparison'
    | 'regional_comparison_desc'
    | 'per_100k'
    | 'no_regional_data'
    | 'active_clusters_title'
    | 'cluster_detection_desc'
    | 'radius'
    | 'population'
    | 'detected'

    // Analytics Page
    | 'analytics_title'
    | 'analytics_subtitle'
    | 'deployed_ml_models'
    | 'model_details_desc'
    | 'active'
    | 'inactive'
    | 'features'
    | 'gb_corrector'
    | 'scoring_method'
    | 'xgboost_component'
    | 'risk_tiers'
    | 'disease_case_distribution'
    | 'trending_diseases_growth'
    | 'regional_risk_assessment'
    | 'anomaly_detection_results'
    | 'resolved'
    | 'deviation'
    | 'score'
    | 'probability'
    | 'cases'

    // Surveillance Page
    | 'surveillance_data_title'
    | 'surveillance_data_subtitle'
    | 'filters'
    | 'all_regions'
    | 'disease_distribution_map'
    | 'no_map_data'
    | 'surveillance_records'
    | 'no_surveillance_data'
    | 'environmental_data'
    | 'environmental_data_desc'
    | 'temp'
    | 'humidity'
    | 'rainfall'
    | 'aqi'
    | 'pm25'
    | 'pm10'
    | 'cases_per_100k_col'
    | 'severity_col'

    // Alerts Page
    | 'alerts_management_title'
    | 'alerts_management_desc'
    | 'all_status'
    | 'acknowledged'
    | 'false_positive'
    | 'all_severity'
    | 'alerts_found'
    | 'confidence'
    | 'level'
    | 'actions'
    | 'ack_by'
    | 'acknowledge'
    | 'resolve'
    | 'escalate'
    | 'no_alerts_found';

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
        health_system: 'ArogyaTrack',

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
        no_prescriptions: 'No prescriptions yet',

        // Medical Records Page
        medical_records_page_title: 'Medical Records',
        medical_records_page_subtitle: 'Complete history of your medical consultations',
        allergies_title: 'Allergies',
        no_allergies: 'No allergies recorded',
        consultation_history: 'Consultation History',
        attached_reports: 'Attached Reports',

        // Prescriptions Page
        prescriptions_page_title: 'My Prescriptions',
        prescriptions_page_subtitle: 'View all your prescriptions and medication details',
        prescription_file: 'prescription(s) on file',
        medicine_name: 'Medicine Name',
        dosage: 'Dosage',
        frequency: 'Frequency',
        duration: 'Duration',
        quantity: 'Qty',
        instructions: 'Instructions',
        dispense_status: 'Dispense Status',

        // Doctor Dashboard
        doctor_dashboard_title: 'Doctor Dashboard',
        doctor_dashboard_subtitle: "Today's snapshot & surveillance overview",
        scan_patient_qr: 'Scan Patient QR',
        total_assigned_patients: 'Total Assigned Patients',
        high_risk_patients: 'High-Risk Patients',
        pending_lab_reviews: 'Pending Lab Reviews',
        recent_updates: 'Recent Updates',
        recent_activity: 'Recent Activity',
        view_high_risk: 'View All High-Risk',
        no_high_risk_patients: 'No high-risk patients detected.',
        no_recent_activity: 'No recent activity.',
        patient_queue: 'Patient Queue',
        patients_seen_today: 'Patients Seen Today',
        pending_reports: 'Pending Reports',

        // QR Scan Page
        scan_qr_title: 'Scan Patient QR',
        scan_qr_subtitle: 'Scan patient health card to access medical records',
        camera_scanner: 'Camera Scanner',
        camera_scanner_desc: "Use your device's camera to scan the QR code",
        manual_entry: 'Manual Entry',
        manual_entry_desc: 'Access records using Patient ID or Token',
        universal_patient_id: 'Universal Patient ID',
        find_patient: 'Find Patient',
        digital_token: 'Digital Token',
        access_via_token: 'Access via Token',
        camera_access_error: 'Camera Access Error',
        camera_active: 'Camera active - Point at QR code',
        start_camera: 'Start Camera Scanner',
        stop_scanner: 'Stop Scanner',
        patient_data_loaded: 'Patient data loaded successfully',
        clear_patient_data: 'Clear Patient Data',
        scan_another: 'Scan Another QR',
        add_to_my_patients: 'Add to My Patients',
        create_visit_record: 'Create Visit Record',
        current_vitals: 'Current Vitals',
        medical_records_history: 'Medical Records & History',
        recent_prescriptions: 'Recent Prescriptions',

        // High Risk Page
        high_risk_title: 'High-Risk Patients',
        high_risk_subtitle: 'Patients flagged for chronic conditions, abnormal vitals, or elevated lab results',
        flagged: 'Flagged',
        search_high_risk: 'Search by name, ID, risk level, or condition...',
        analysing_risk: 'Analysing patient risk factors...',
        no_high_risk_found: 'No High-Risk Patients',
        no_high_risk_desc: 'None of your patients are currently flagged as high-risk.',
        primary_condition: 'Primary Condition',
        risk_factors: 'Risk Factors',
        abnormal_labs_count: 'Abnormal Labs',
        new_record: 'New Record',
        view_history: 'View History',
        critical: 'Critical',
        high_risk: 'High',
        medium_risk: 'Medium',
        low_risk: 'Low',

        // My Patients Page
        my_patients_title: 'My Patients',
        my_patients_subtitle: 'Manage your patients and create consultation records',
        total: 'Total',
        search_patients_placeholder: 'Search by name, patient ID, or district...',
        loading_patients: 'Loading patients...',
        error_loading_patients: 'Error Loading Patients',
        no_patients_found: 'No Patients Found',
        adjust_search: 'Try adjusting your search terms',
        scan_qr_prompt: "Scan a patient's health card QR code to add them to your list",
        scan_qr_now: 'Scan QR Now',
        create_record: 'Create Record',
        history: 'History',

        // Add Record Page
        add_record_title: 'Add / Update Record',
        add_record_subtitle: 'Create a new consultation or visit record for a patient',
        visit_details: 'Patient & Visit Details',
        select_patient: 'Select Patient',
        choose_patient: '-- Choose a patient --',
        visit_date: 'Visit Date & Time',
        upload_reports: 'Upload Reports (optional)',
        upload_reports_desc: 'PDF, JPG, PNG – max 10 MB each',
        save_record: 'Save Visit Record',
        saving: 'Saving...',
        record_saved_success: 'Record Created Successfully!',
        record_saved_desc: "The visit record has been saved to the patient's file.",
        create_another: 'Create Another Record',
        click_upload: 'Click to upload PDF or image',
        add_more_files: 'Add more files',

        // Patient Details Page
        patient_history: 'Patient History',
        no_records_found: 'No medical records found',
        create_new_record_short: 'New Record',
        diagnosis_label: 'Diagnosis',
        treatment_label: 'Treatment',
        date_label: 'Date',
        doctor_label: 'Doctor',
        attachments: 'Attachments',

        // Admin Dashboard
        admin_dashboard_title: 'Surveillance Dashboard',
        admin_dashboard_subtitle: 'Real-time disease monitoring and ML analytics',
        refresh_data: 'Refresh Data',
        cases_today: 'Cases Today',
        active_alerts_count: 'Active Alerts',
        active_clusters: 'Active Clusters',
        monitored_regions: 'Monitored Regions',
        high_risk_regions: 'High Risk Regions',
        unresolved_anomalies: 'Unresolved Anomalies',
        ml_pipeline_control: 'ML Pipeline Control',
        ml_pipeline_desc: 'Monitor and trigger ML model pipeline runs',
        run_pipeline: 'Run Pipeline',
        pipeline_loading: 'Pipeline status unavailable — check backend connection',
        records_7d: 'Records (7d)',
        forecasts_today: 'Forecasts today',
        anomalies_7d: 'Anomalies (7d)',
        risk_scores_today: 'Risk scores today',
        regions: 'Regions',
        active_alerts_title: 'Active Alerts',
        confidence: 'confidence',
        acknowledge: 'Acknowledge',
        disease_heat_map: 'Disease Heat Map',
        disease_heat_map_desc: 'Interactive map showing disease distribution across regions',
        all_diseases: 'All Diseases',
        reset_view: 'Reset View',
        no_heat_map_data: 'No heat map data available',
        disease_statistics: 'Disease Statistics',
        no_disease_data: 'No disease data available',
        case_forecasts: 'Case Forecasts',
        forecast_days: 'day forecast',
        predictions: 'predictions',
        avg_confidence: 'Avg confidence',
        no_forecast_data: 'No forecast data available',
        recent_anomalies: 'Recent Anomalies',
        anomaly_detection_desc: 'Detected by Isolation Forest v5.0 ensemble + GB corrector',
        actual: 'actual',
        expected: 'expected',
        no_anomalies: 'No anomalies detected',
        regional_risk_scores: 'Regional Risk Scores',
        risk_score_desc: 'Computed by XGBoost v4.0 outbreak classifier (56 features)',
        no_risk_scores: 'No risk scores available',
        trending_diseases: 'Trending Diseases',
        trending_growth_desc: 'Week-over-week growth by disease',
        no_trending_data: 'No trending data',
        regional_comparison: 'Regional Comparison',
        regional_comparison_desc: 'Cases per 100k population by region',
        per_100k: 'per 100k',
        no_regional_data: 'No regional data available',
        active_clusters_title: 'Active Clusters',
        cluster_detection_desc: 'Detected by DBSCAN v5.0 geo-clustering (13 features)',
        radius: 'Radius',
        population: 'Population',
        detected: 'Detected',

        // Analytics Page
        analytics_title: 'Analytics',
        analytics_subtitle: 'ML-powered disease analytics and insights',
        deployed_ml_models: 'Deployed ML Models (v5.0)',
        model_details_desc: 'Model details, performance metrics, and feature counts',
        active: 'Active',
        inactive: 'Inactive',
        features: 'features',
        gb_corrector: 'GB Corrector',
        scoring_method: 'Scoring Method',
        xgboost_component: 'XGBoost component',
        risk_tiers: 'Risk Tiers',
        disease_case_distribution: 'Disease Case Distribution',
        trending_diseases_growth: 'Trending Diseases Growth',
        regional_risk_assessment: 'Regional Risk Assessment',
        anomaly_detection_results: 'Anomaly Detection Results',
        resolved: 'Resolved',
        deviation: 'Deviation',
        score: 'Score',
        probability: 'Probability',
        cases: 'Cases',

        // Surveillance Page
        surveillance_data_title: 'Surveillance Data',
        surveillance_data_subtitle: 'Monitor disease data across regions',
        filters: 'Filters',
        all_regions: 'All Regions',
        disease_distribution_map: 'Disease Distribution Map',
        no_map_data: 'No map data available',
        surveillance_records: 'Surveillance Records',
        no_surveillance_data: 'No surveillance data available',
        environmental_data: 'Environmental Data',
        environmental_data_desc: 'Recent environmental readings for selected region',
        temp: 'Temp (°C)',
        humidity: 'Humidity (%)',
        rainfall: 'Rainfall (mm)',
        aqi: 'AQI',
        pm25: 'PM2.5',
        pm10: 'PM10',
        cases_per_100k_col: 'Per 100k',
        severity_col: 'Severity',

        // Alerts Page
        alerts_management_title: 'Alerts Management',
        alerts_management_desc: 'Multi-model alert system — review, acknowledge, and resolve alerts',
        all_status: 'All Status',
        acknowledged: 'Acknowledged',
        false_positive: 'False Positive',
        all_severity: 'All Severity',
        alerts_found: 'alerts found',
        level: 'Level',
        actions: 'Actions',
        ack_by: 'Ack by',
        resolve: 'Resolve',
        escalate: 'Escalate',
        no_alerts_found: 'No alerts found matching the current filters.'
    },
    hi: {
        // Common
        welcome_back: 'वापसी पर स्वागत है',
        last_login: 'पिछला लॉगिन',
        ago: 'पहले',
        just_now: 'अभी अभी',
        first_login: 'पहला लॉगिन',
        dashboard_title: 'आरोग्यट्रैक डैशबोर्ड',
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
        health_system: 'आरोग्यट्रैक',

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
        no_prescriptions: 'अभी तक कोई नुस्खे नहीं',

        // Medical Records Page
        medical_records_page_title: 'चिकित्सा रिकॉर्ड',
        medical_records_page_subtitle: 'आपके चिकित्सा परामर्श का पूरा इतिहास',
        allergies_title: 'एलर्जी',
        no_allergies: 'कोई एलर्जी दर्ज नहीं',
        consultation_history: 'परामर्श इतिहास',
        attached_reports: 'संलग्न रिपोर्ट',

        // Prescriptions Page
        prescriptions_page_title: 'मेरे नुस्खे',
        prescriptions_page_subtitle: 'अपने सभी नुस्खे और दवा विवरण देखें',
        prescription_file: 'नुस्खे फ़ाइल पर',
        medicine_name: 'दवा का नाम',
        dosage: 'खुराक',
        frequency: 'आवृत्ति',
        duration: 'अवधि',
        quantity: 'मात्रा',
        instructions: 'निर्देश',
        dispense_status: 'वितरण स्थिति',

        // Doctor Dashboard
        doctor_dashboard_title: 'डॉक्टर डैशबोर्ड',
        doctor_dashboard_subtitle: 'आज का स्नैपशॉट और निगरानी अवलोकन',
        scan_patient_qr: 'रोगी QR स्कैन करें',
        total_assigned_patients: 'कुल निर्दिष्ट रोगी',
        high_risk_patients: 'उच्च जोखिम वाले रोगी',
        pending_lab_reviews: 'लंबित लैब समीक्षा',
        recent_updates: 'हाल ही के अपडेट',
        recent_activity: 'हालिया गतिविधि',
        view_high_risk: 'सभी उच्च जोखिम वाले देखें',
        no_high_risk_patients: 'कोई उच्च जोखिम वाले रोगी नहीं मिले।',
        no_recent_activity: 'कोई हालिया गतिविधि नहीं।',
        patient_queue: 'रोगी कतार',
        patients_seen_today: 'आज देखे गए रोगी',
        pending_reports: 'लंबित रिपोर्ट',

        // QR Scan Page
        scan_qr_title: 'रोगी QR स्कैन करें',
        scan_qr_subtitle: 'चिकित्सा रिकॉर्ड तक पहुँचने के लिए रोगी स्वास्थ्य कार्ड स्कैन करें',
        camera_scanner: 'कैमरा स्कैनर',
        camera_scanner_desc: 'QR कोड स्कैन करने के लिए अपने डिवाइस के कैमरे का उपयोग करें',
        manual_entry: 'मैनुअल प्रविष्टि',
        manual_entry_desc: 'रोगी आईडी या टोकन का उपयोग करके रिकॉर्ड तक पहुँचें',
        universal_patient_id: 'यूनिवर्सल रोगी आईडी',
        find_patient: 'रोगी खोजें',
        digital_token: 'डिजिटल टोकन',
        access_via_token: 'टोकन के माध्यम से पहुँचें',
        camera_access_error: 'कैमरा एक्सेस त्रुटि',
        camera_active: 'कैमरा सक्रिय - QR कोड की ओर इंगित करें',
        start_camera: 'कैमरा स्कैनर शुरू करें',
        stop_scanner: 'स्कैनर बंद करें',
        patient_data_loaded: 'रोगी डेटा सफलतापूर्वारक लोड किया गया',
        clear_patient_data: 'रोगी डेटा साफ़ करें',
        scan_another: 'दूसरा QR स्कैन करें',
        add_to_my_patients: 'मेरे रोगियों में जोड़ें',
        create_visit_record: 'विजिट रिकॉर्ड बनाएं',
        current_vitals: 'वर्तमान विटल्स',
        medical_records_history: 'चिकित्सा रिकॉर्ड और इतिहास',
        recent_prescriptions: 'हालिया नुस्खे',

        // High Risk Page
        high_risk_title: 'उच्च जोखिम वाले रोगी',
        high_risk_subtitle: 'दीर्घकालिक स्थितियों, असामान्य विटल्स, या बढ़े हुए लैब परिणामों के लिए चिह्नित रोगी',
        flagged: 'चिह्नित',
        search_high_risk: 'नाम, आईडी, जोखिम स्तर, या स्थिति द्वारा खोजें...',
        analysing_risk: 'रोगी जोखिम कारकों का विश्लेषण कर रहा है...',
        no_high_risk_found: 'कोई उच्च जोखिम वाले रोगी नहीं',
        no_high_risk_desc: 'वर्तमान में आपका कोई भी रोगी उच्च जोखिम के रूप में चिह्नित नहीं है।',
        primary_condition: 'प्राथमिक स्थिति',
        risk_factors: 'जोखिम कारक',
        abnormal_labs_count: 'असामान्य लैब परिणाम',
        new_record: 'नया रिकॉर्ड',
        view_history: 'इतिहास देखें',
        critical: 'गंभीर',
        high_risk: 'उच्च',
        medium_risk: 'मध्यम',
        low_risk: 'कम',

        // My Patients Page
        my_patients_title: 'मेरे रोगी',
        my_patients_subtitle: 'अपने रोगियों का प्रबंधन करें और परामर्श रिकॉर्ड बनाएं',
        total: 'कुल',
        search_patients_placeholder: 'नाम, रोगी आईडी, या जिले द्वारा खोजें...',
        loading_patients: 'रोगी लोड हो रहे हैं...',
        error_loading_patients: 'रोगी लोड करने में त्रुटि',
        no_patients_found: 'कोई रोगी नहीं मिला',
        adjust_search: 'अपनी खोज शर्तों को समायोजित करने का प्रयास करें',
        scan_qr_prompt: 'उन्हें अपनी सूची में जोड़ने के लिए रोगी के स्वास्थ्य कार्ड QR कोड को स्कैन करें',
        scan_qr_now: 'QR स्कैन करें',
        create_record: 'रिकॉर्ड बनाएं',
        history: 'इतिहास',

        // Add Record Page
        add_record_title: 'रिकॉर्ड जोड़ें / अपडेट करें',
        add_record_subtitle: 'रोगी के लिए एक नया परामर्श या विजिट रिकॉर्ड बनाएं',
        visit_details: 'रोगी और विजिट विवरण',
        select_patient: 'रोगी चुनें',
        choose_patient: '-- एक रोगी चुनें --',
        visit_date: 'विजिट दिनांक और समय',
        upload_reports: 'रिपोर्ट अपलोड करें (वैकल्पिक)',
        upload_reports_desc: 'पीडीएफ, जेपीजी, पीएनजी - अधिकतम 10 एमबी प्रत्येक',
        save_record: 'विजिट रिकॉर्ड सहेजें',
        saving: 'सहेजा जा रहा है...',
        record_saved_success: 'रिकॉर्ड सफलतापूर्वक बनाया गया!',
        record_saved_desc: 'विजिट रिकॉर्ड रोगी की फ़ाइल में सहेजा गया है।',
        create_another: 'दूसरा रिकॉर्ड बनाएं',
        click_upload: 'पीडीएफ या छवि अपलोड करने के लिए क्लिक करें',
        add_more_files: 'और फ़ाइलें जोड़ें',

        // Patient Details Page
        patient_history: 'रोगी का इतिहास',
        no_records_found: 'कोई चिकित्सा रिकॉर्ड नहीं मिला',
        create_new_record_short: 'नया रिकॉर्ड',
        diagnosis_label: 'निदान',
        treatment_label: 'उपचार',
        date_label: 'दिनांक',
        doctor_label: 'डॉक्टर',
        attachments: 'संलग्नक',

        // Admin Dashboard
        admin_dashboard_title: 'निगरानी डैशबोर्ड',
        admin_dashboard_subtitle: 'वास्तविक समय रोग निगरानी और एमएल एनालिटिक्स',
        refresh_data: 'डेटा अपडेट करें',
        cases_today: 'आज के मामले',
        active_alerts_count: 'सक्रिय अलर्ट',
        active_clusters: 'सक्रिय क्लस्टर',
        monitored_regions: 'निगरानी वाले क्षेत्र',
        high_risk_regions: 'उच्च जोखिम वाले क्षेत्र',
        unresolved_anomalies: 'अनसुलझी विसंगतियां',
        ml_pipeline_control: 'एमएल पाइपलाइन नियंत्रण',
        ml_pipeline_desc: 'एमएल मॉडल पाइपलाइन रन की निगरानी और ट्रिगर करें',
        run_pipeline: 'पाइपलाइन चलाएं',
        pipeline_loading: 'पाइपलाइन स्थिति अनुपलब्ध - बैकएंड कनेक्शन की जांच करें',
        records_7d: 'रिकॉर्ड (7 दिन)',
        forecasts_today: 'आज का पूर्वानुमान',
        anomalies_7d: 'विसंगतियां (7 दिन)',
        risk_scores_today: 'आज के जोखिम स्कोर',
        regions: 'क्षेत्र',
        active_alerts_title: 'सक्रिय अलर्ट',
        confidence: 'विश्वास',
        acknowledge: 'स्वीकार करें',
        disease_heat_map: 'रोग हीट मैप',
        disease_heat_map_desc: 'विभिन्न क्षेत्रों में रोग वितरण दिखाने वाला इंटरैक्टिव मानचित्र',
        all_diseases: 'सभी बीमारियाँ',
        reset_view: 'दृश्य रीसेट करें',
        no_heat_map_data: 'कोई हीट मैप डेटा उपलब्ध नहीं है',
        disease_statistics: 'रोग सांख्यिकी',
        no_disease_data: 'कोई रोग डेटा उपलब्ध नहीं है',
        case_forecasts: 'मामले का पूर्वानुमान',
        forecast_days: 'दिन का पूर्वानुमान',
        predictions: 'भविष्यवाणियां',
        avg_confidence: 'औसत विश्वास',
        no_forecast_data: 'कोई पूर्वानुमान डेटा उपलब्ध नहीं है',
        recent_anomalies: 'हालिया विसंगतियां',
        anomaly_detection_desc: 'Isolation Forest v5.0 ensemble + GB corrector द्वारा पता लगाया गया',
        actual: 'वास्तविक',
        expected: 'अपेक्षित',
        no_anomalies: 'कोई विसंगति नहीं पाई गई',
        regional_risk_scores: 'क्षेत्रीय जोखिम स्कोर',
        risk_score_desc: 'XGBoost v4.0 प्रकोप क्लासिफायरियर (56 सुविधाओं) द्वारा गणना की गई',
        no_risk_scores: 'कोई जोखिम स्कोर उपलब्ध नहीं है',
        trending_diseases: 'चलन में बीमारियाँ',
        trending_growth_desc: 'रोग द्वारा सप्ताह-दर-सप्ताह वृद्धि',
        no_trending_data: 'कोई ट्रेंडिंग डेटा नहीं',
        regional_comparison: 'क्षेत्रीय तुलना',
        regional_comparison_desc: 'प्रति 100k आबादी पर मामले',
        per_100k: 'प्रति 100k',
        no_regional_data: 'कोई क्षेत्रीय डेटा उपलब्ध नहीं है',
        active_clusters_title: 'सक्रिय क्लस्टर',
        cluster_detection_desc: 'DBSCAN v5.0 जियो-क्लस्टरिंग (13 सुविधाओं) द्वारा पता लगाया गया',
        radius: 'त्रिज्या',
        population: 'आबादी',
        detected: 'पता चला',

        // Analytics Page
        analytics_title: 'एनालिटिक्स',
        analytics_subtitle: 'एमएल-संचालित रोग विश्लेषण और अंतर्दृष्टि',
        deployed_ml_models: 'तैनात एमएल मॉडल (v5.0)',
        model_details_desc: 'मॉडल विवरण, प्रदर्शन मेट्रिक्स, और सुविधा गणना',
        active: 'सक्रिय',
        inactive: 'निष्क्रिय',
        features: 'विशेषताएं',
        gb_corrector: 'जीबी करेक्टर',
        scoring_method: 'स्कोरिंग विधि',
        xgboost_component: 'XGBoost घटक',
        risk_tiers: 'जोखिम स्तर',
        disease_case_distribution: 'रोग मामले का वितरण',
        trending_diseases_growth: 'ट्रेंडिंग रोगों की वृद्धि',
        regional_risk_assessment: 'क्षेत्रीय जोखिम मूल्यांकन',
        anomaly_detection_results: 'विसंगति का पता लगाने के परिणाम',
        resolved: 'सुलझाया गया',
        deviation: 'विचलन',
        score: 'स्कोर',
        probability: 'संभावना',
        cases: 'मामले',

        // Surveillance Page
        surveillance_data_title: 'निगरानी डेटा',
        surveillance_data_subtitle: 'क्षेत्रों में रोग डेटा की निगरानी करें',
        filters: 'फ़िल्टर',
        all_regions: 'सभी क्षेत्र',
        disease_distribution_map: 'रोग वितरण मानचित्र',
        no_map_data: 'कोई मानचित्र डेटा उपलब्ध नहीं है',
        surveillance_records: 'निगरानी रिकॉर्ड',
        no_surveillance_data: 'कोई निगरानी डेटा उपलब्ध नहीं है',
        environmental_data: 'पर्यावरण डेटा',
        environmental_data_desc: 'चयनित क्षेत्र के लिए हालिया पर्यावरणीय रीडिंग',
        temp: 'तापमान (°C)',
        humidity: 'नमी (%)',
        rainfall: 'वर्षा (मिमी)',
        aqi: 'AQI',
        pm25: 'PM2.5',
        pm10: 'PM10',
        cases_per_100k_col: 'प्रति 100k',
        severity_col: 'गंभीरता',

        // Alerts Page
        alerts_management_title: 'अलर्ट प्रबंधन',
        alerts_management_desc: 'मल्टी-मॉडल अलर्ट सिस्टम - समीक्षा, स्वीकार, और अलर्ट का समाधान',
        all_status: 'सभी स्थितियाँ',
        acknowledged: 'स्वीकार किया गया',
        false_positive: 'गलत सकारात्मक',
        all_severity: 'सभी गंभीरता',
        alerts_found: 'अलर्ट मिले',
        level: 'स्तर',
        actions: 'क्रियाएं',
        ack_by: 'स्वीकृतकर्ता',
        resolve: 'सुलझाएं',
        escalate: 'बढ़ाना',
        no_alerts_found: 'वर्तमान फ़िल्टर से मेल खाने वाले कोई अलर्ट नहीं मिले।'
    },
    mr: {
        // Common
        welcome_back: 'परत स्वागत आहे',
        last_login: 'शेवटचे लॉगिन',
        ago: 'पूर्वी',
        just_now: 'आत्ताच',
        first_login: 'पहिले लॉगिन',
        dashboard_title: 'आरोग्यट्रैक डॅशबोर्ड',
        select_language: 'भाषा निवडा',
        loading: 'लोड होत आहे...',
        failed_load: 'डेटा लोड करण्यात अयशस्वी',
        try_again: 'कृपया नंतर पुन्हा प्रयत्न करा',
        no_data: 'कोणताही डेटा उपलब्ध नहीं',
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
        health_system: 'आरोग्यट्रैक',

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
        no_prescriptions: 'अद्याप कोणतीही प्रिस्क्रिप्शन नाहीत',

        // Medical Records Page
        medical_records_page_title: 'वैद्यकीय नोंदी',
        medical_records_page_subtitle: 'तुमच्या वैद्यकीय सल्लामसलतांचा संपूर्ण इतिहास',
        allergies_title: 'लॅर्जी',
        no_allergies: 'कोणतीही ऍलर्जी नोंदलेली नाही',
        consultation_history: 'सल्लामसलत इतिहास',
        attached_reports: 'संलग्न अहवाल',

        // Prescriptions Page
        prescriptions_page_title: 'माझे प्रिस्क्रिप्शन',
        prescriptions_page_subtitle: 'तुमची सर्व प्रिस्क्रिप्शन आणि औषधांचा तपशील पहा',
        prescription_file: 'प्रिस्क्रिप्शन फाईलवर',
        medicine_name: 'औषधाचे नाव',
        dosage: 'डोस',
        frequency: 'वारंवारता',
        duration: 'कालावधी',
        quantity: 'प्रमाण',
        instructions: 'सूचना',
        dispense_status: 'वितरण स्थिती',

        // Doctor Dashboard
        doctor_dashboard_title: 'डॉक्टर डॅशबोर्ड',
        doctor_dashboard_subtitle: 'आजचा स्नॅपशॉट आणि पाळत ठेवणे विहंगावलोकन',
        scan_patient_qr: 'रुग्ण QR स्कॅन करा',
        total_assigned_patients: 'एकूण नियुक्त रुग्ण',
        high_risk_patients: 'उच्च-जोखीम रुग्ण',
        pending_lab_reviews: 'प्रलंबित लॅब पुनरावलोकने',
        recent_updates: 'अलीकडील अद्यतने',
        recent_activity: 'अलीकडील क्रियाकलाप',
        view_high_risk: 'सर्व उच्च-जोखीम पहा',
        no_high_risk_patients: 'कोणतेही उच्च-जोखीम रुग्ण आढळले नाहीत.',
        no_recent_activity: 'कोणतीही अलीकडील क्रियाकलाप नाही.',
        patient_queue: 'रुग्ण रांग',
        patients_seen_today: 'आज पाहिलेले रुग्ण',
        pending_reports: 'प्रलंबित अहवाल',

        // QR Scan Page
        scan_qr_title: 'रुग्ण QR स्कॅन करा',
        scan_qr_subtitle: 'वैद्यकीय नोंदींमध्ये प्रवेश करण्यासाठी रुग्ण आरोग्य कार्ड स्कॅन करा',
        camera_scanner: 'कॅमेरा स्कॅनर',
        camera_scanner_desc: 'QR कोड स्कॅन करण्यासाठी आपल्या डिव्हाइसचा कॅमेरा वापरा',
        manual_entry: 'मॅन्युअल एंट्री',
        manual_entry_desc: 'रुग्ण आयडी किंवा टोकन वापरून नोंदींमध्ये प्रवेश करा',
        universal_patient_id: 'युनिव्हर्सल रुग्ण आयडी',
        find_patient: 'रुग्ण शोधा',
        digital_token: 'डिजिटल टोकन',
        access_via_token: 'टोकनद्वारे प्रवेश करा',
        camera_access_error: 'कॅमेरा प्रवेश त्रुटी',
        camera_active: 'कॅमेरा सक्रिय - QR कोडकडे निर्देशित करा',
        start_camera: 'कॅमेरा स्कॅनर सुरू करा',
        stop_scanner: 'स्कॅनर थांबवा',
        patient_data_loaded: 'रुग्ण डेटा यशस्वीरित्या लोड झाला',
        clear_patient_data: 'रुग्ण डेटा साफ करा',
        scan_another: 'दुसरा QR स्कॅन करा',
        add_to_my_patients: 'माझ्या रुग्णांमध्ये जोडा',
        create_visit_record: 'भेट रेकॉर्ड तयार करा',
        current_vitals: 'वर्तमान व्हिटल्स',
        medical_records_history: 'वैद्यकीय नोंदी आणि इतिहास',
        recent_prescriptions: 'अलीकडील प्रिस्क्रिप्शन',

        // High Risk Page
        high_risk_title: 'उच्च-जोखीम असलेले रुग्ण',
        high_risk_subtitle: 'जुनाट आजार, असामान्य व्हिटल्स किंवा वाढलेल्या लॅब निकालांसाठी चिन्हांकित रुग्ण',
        flagged: 'चिन्हांकित',
        search_high_risk: 'नाव, आयडी, जोखीम स्तर किंवा स्थितीनुसार शोधा...',
        analysing_risk: 'रुग्ण जोखीम घटकांचे विश्लेषण करत आहे...',
        no_high_risk_found: 'कोणतेही उच्च-जोखीम रुग्ण नाहीत',
        no_high_risk_desc: 'सध्या तुमच्या कोणत्याही रुग्णाला उच्च-जोखीम म्हणून चिन्हांकित केलेले नाही.',
        primary_condition: 'प्राथमिक स्थिती',
        risk_factors: 'जोखिम घटक',
        abnormal_labs_count: 'असामान्य लॅब परिणाम',
        new_record: 'नवीन रेकॉर्ड',
        view_history: 'इतिहास पहा',
        critical: 'गंभीर',
        high_risk: 'उच्च',
        medium_risk: 'मध्यम',
        low_risk: 'कमी',

        // My Patients Page
        my_patients_title: 'माझे रुग्ण',
        my_patients_subtitle: 'तुमच्या रुग्णांचे व्यवस्थापन करा आणि सल्लामसलत रेकॉर्ड तयार करा',
        total: 'एकूण',
        search_patients_placeholder: 'नाव, रुग्ण आयडी किंवा जिल्ह्यानुसार शोधा...',
        loading_patients: 'रुग्ण लोड होत आहेत...',
        error_loading_patients: 'रुग्ण लोड करण्यात त्रुटी',
        no_patients_found: 'कोणतेही रुग्ण आढळले नाहीत',
        adjust_search: 'तुमच्या शोध अटी समायोजित करण्याचा प्रयत्न करा',
        scan_qr_prompt: 'त्यांना तुमच्या यादीत जोडण्यासाठी रुग्णाचे आरोग्य कार्ड QR कोड स्कॅन करा',
        scan_qr_now: 'QR स्कॅन करा',
        create_record: 'रेकॉर्ड तयार करा',
        history: 'इतिहास',

        // Add Record Page
        add_record_title: 'रेकॉर्ड जोडा / अपडेट करा',
        add_record_subtitle: 'रुग्णासाठी नवीन सल्लामसलत किंवा भेट रेकॉर्ड तयार करा',
        visit_details: 'रुग्ण आणि भेट तपशील',
        select_patient: 'रुग्ण निवडा',
        choose_patient: '-- रुग्ण निवडा --',
        visit_date: 'भेट तारीख आणि वेळ',
        upload_reports: 'अहवाल अपलोड करा (पर्यायी)',
        upload_reports_desc: 'PDF, JPG, PNG - कमाल 10 MB प्रत्येकी',
        save_record: 'भेट रेकॉर्ड जतन करा',
        saving: 'जतन करत आहे...',
        record_saved_success: 'रेकॉर्ड यशस्वीरित्या तयार केले!',
        record_saved_desc: 'भेट रेकॉर्ड रुग्णाच्या फाईलमध्ये जतन केले गेले आहे.',
        create_another: 'दुसरा रेकॉर्ड तयार करा',
        click_upload: 'PDF किंवा प्रतिमा अपलोड करण्यासाठी क्लिक करा',
        add_more_files: 'आणखी फाईल्स जोडा',

        // Patient Details Page
        patient_history: 'रुग्ण इतिहास',
        no_records_found: 'कोणतेही वैद्यकीय रेकॉर्ड आढळले नाहीत',
        create_new_record_short: 'नवीन रेकॉर्ड',
        diagnosis_label: 'निदान',
        treatment_label: 'उपचार',
        date_label: 'तारीख',
        doctor_label: 'डॉक्टर',
        attachments: 'संलग्नक',

        // Admin Dashboard
        admin_dashboard_title: 'देखरेख डॅशबोर्ड',
        admin_dashboard_subtitle: 'रिअल-टाइम रोग निरीक्षण आणि एमएल विश्लेषण',
        refresh_data: 'डेटा रिफ्रेश करा',
        cases_today: 'आजची प्रकरणे',
        active_alerts_count: 'सक्रिय अलर्ट',
        active_clusters: 'सक्रिय क्लस्टर',
        monitored_regions: 'निरीक्षण केलेले प्रदेश',
        high_risk_regions: 'उच्च जोखीम असलेले प्रदेश',
        unresolved_anomalies: 'न सुटलेली विसंगती',
        ml_pipeline_control: 'एमएल पाइपलाइन नियंत्रण',
        ml_pipeline_desc: 'एमएल मॉडेल पाइपलाइन रनचे निरीक्षण करा आणि ट्रिगर करा',
        run_pipeline: 'पाइपलाइन चालवा',
        pipeline_loading: 'पाइपलाइन स्थिती अनुपलब्ध - बॅकएंड कनेक्शन तपासा',
        records_7d: 'रेकॉर्ड (7 दिवस)',
        forecasts_today: 'आजचे अंदाज',
        anomalies_7d: 'विसंगती (7 दिवस)',
        risk_scores_today: 'आजचे जोखीम स्कोअर',
        regions: 'प्रदेश',
        active_alerts_title: 'सक्रिय अलर्ट',
        confidence: 'विश्वास',
        acknowledge: 'स्वीकार करा',
        disease_heat_map: 'रोग हीट मॅप',
        disease_heat_map_desc: 'वेगवेगळ्या प्रदेशांमध्ये रोगाचे वितरण दर्शविणारा परस्परसंवादी नकाशा',
        all_diseases: 'सर्व रोग',
        reset_view: 'दृश्य रीसेट करा',
        no_heat_map_data: 'कोणताही हीट मॅप डेटा उपलब्ध नाही',
        disease_statistics: 'रोग आकडेवारी',
        no_disease_data: 'कोणताही रोग डेटा उपलब्ध नाही',
        case_forecasts: 'केस अंदाज',
        forecast_days: 'दिवसांचा अंदाज',
        predictions: 'अंदाजे',
        avg_confidence: 'सरासरी विश्वास',
        no_forecast_data: 'कोणताही अंदाज डेटा उपलब्ध नाही',
        recent_anomalies: 'अलीकडील विसंगती',
        anomaly_detection_desc: 'Isolation Forest v5.0 ensemble + GB corrector द्वारे आढळले',
        actual: 'वास्तविक',
        expected: 'अपेक्षित',
        no_anomalies: 'कोणतीही विसंगती आढळली नाही',
        regional_risk_scores: 'प्रादेशिक जोखीम स्कोअर',
        risk_score_desc: 'XGBoost v4.0 आउटब्रेक क्लासिफायर (56 वैशिष्ट्ये) द्वारे गणना केली',
        no_risk_scores: 'कोणतेही जोखीम स्कोअर उपलब्ध नाहीत',
        trending_diseases: 'ट्रेंडिंग रोग',
        trending_growth_desc: 'रोगाद्वारे आठवड्या-दर-आठवड्यात वाढ',
        no_trending_data: 'कोणताही ट्रेंडिंग डेटा नाही',
        regional_comparison: 'प्रादेशिक तुलना',
        regional_comparison_desc: 'प्रति 100k लोकसंख्येवर प्रकरणे',
        per_100k: 'प्रति 100k',
        no_regional_data: 'कोणताही प्रादेशिक डेटा उपलब्ध नाही',
        active_clusters_title: 'सक्रिय क्लस्टर',
        cluster_detection_desc: 'DBSCAN v5.0 जिओ-क्लस्टरिंग (13 वैशिष्ट्ये) द्वारे आढळले',
        radius: 'त्रिज्या',
        population: 'लोकसंख्या',
        detected: 'आढळले',

        // Analytics Page
        analytics_title: 'एनालिटिक्स',
        analytics_subtitle: 'एमएल-समर्थित रोग विश्लेषण आणि अंतर्दृष्टी',
        deployed_ml_models: 'तैनात एमएल मॉडेल (v5.0)',
        model_details_desc: 'मॉडेल तपशील, कार्यप्रदर्शन मेट्रिक्स आणि वैशिष्ट्ये',
        active: 'सक्रिय',
        inactive: 'निष्क्रिय',
        features: 'वैशिष्ट्ये',
        gb_corrector: 'जीबी करेक्टर',
        scoring_method: 'स्कोरिंग पद्धत',
        xgboost_component: 'XGBoost घटक',
        risk_tiers: 'जोखिम स्तर',
        disease_case_distribution: 'रोग प्रकरण वितरण',
        trending_diseases_growth: 'ट्रेंडिंग रोगांची वाढ',
        regional_risk_assessment: 'प्रादेशिक जोखीम मूल्यांकन',
        anomaly_detection_results: 'विसंगती शोध परिणाम',
        resolved: 'सोडवले',
        deviation: 'विचलन',
        score: 'स्कोअर',
        probability: 'संभाव्यता',
        cases: 'रुग्ण',

        // Surveillance Page
        surveillance_data_title: 'निगरानी डेटा',
        surveillance_data_subtitle: 'प्रदेशांमधील रोग डेटाचे निरीक्षण करा',
        filters: 'फिल्टर्स',
        all_regions: 'सर्व प्रदेश',
        disease_distribution_map: 'रोग वितरण नकाशा',
        no_map_data: 'कोणताही नकाशा डेटा उपलब्ध नाही',
        surveillance_records: 'निगरानी नोंदी',
        no_surveillance_data: 'कोणताही निगरानी डेटा उपलब्ध नाही',
        environmental_data: 'पर्यावरण डेटा',
        environmental_data_desc: 'निवडलेल्या क्षेत्रासाठी अलीकडील पर्यावरणीय वाचन',
        temp: 'तापमान (°C)',
        humidity: 'आर्द्रता (%)',
        rainfall: 'पाऊस (मिमी)',
        aqi: 'AQI',
        pm25: 'PM2.5',
        pm10: 'PM10',
        cases_per_100k_col: 'प्रति 100k',
        severity_col: 'तीव्रता',

        // Alerts Page
        alerts_management_title: 'अलर्ट व्यवस्थापन',
        alerts_management_desc: 'मल्टी-मॉडेल अलर्ट सिस्टम - पुनरावलोकन, कबूल करणे आणि अलर्ट सोडवणे',
        all_status: 'सर्व स्थिती',
        acknowledged: 'कबूल केले',
        false_positive: 'चुकीचे सकारात्मक',
        all_severity: 'सर्व तीव्रता',
        alerts_found: 'अलर्ट आढळले',
        level: 'स्तर',
        actions: 'क्रिया',
        ack_by: 'कडून कबूल',
        resolve: 'सोडवा',
        escalate: 'वाढवा',
        no_alerts_found: 'सध्याच्या फिल्टरशी जुळणारे कोणतेही अलर्ट आढळले नाहीत.'
    }
};
