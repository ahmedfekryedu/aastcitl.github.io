(function(root){'use strict';
 const criteria=[
 ['تحديث منصة Moodle','Update the Moodle'],['رفع توصيف المقرر على Moodle','Upload Updated Course File'],['استلام الطلاب للكتاب الدراسي','Getting the Textbook'],
 ['استخدام الكتاب الدراسي','Using the Textbook'],['تسليم توصيف المقرر ومطابقته مع Progress Sheet','Course Description & Progress Sheet'],['تسليم Welcome Package للمنتدبين','Welcome Package'],
 ['متابعة تنفيذ المحاضرات والسكاشن','Classroom Follow-up'],['الأنشطة التعليمية الداعمة وتحليل آراء الطلاب','Supportive Educational Activities'],['استخدام Rubric لتقييم المشاريع والأبحاث','Assessment Rubric'],
 ['استخدام البرمجيات','Software'],['دراسات حالة CITL Case Study Booklet','Case Studies'],['أهداف التنمية المستدامة','Sustainable Development Goals'],
 ['توقيتات وطرق التقييم ومطابقتها للتوصيف','Assessment Dates & Methods'],['متابعة إدخال الدرجات','Results Entry'],['متطلبات ومستندات نظم الجودة','Quality Documents'],
 ['اجتماعات المحاضر واستراتيجيات التعليم والتعلم','Meetings with Lecturers'],['ملاحظات رئيس القسم','Remarks by Head of Department']
 ];
 const states={DRAFT:'مسودة',IN_PROGRESS:'قيد الاستكمال',SUBMITTED_TO_DEPARTMENT:'بانتظار مراجعة القسم',RETURNED_BY_DEPARTMENT:'أعيد من القسم',DEPARTMENT_APPROVED:'معتمد من القسم',RETURNED_BY_EDUCATION_AFFAIRS:'أعيد من شؤون التعليم',FINAL_APPROVED:'اعتماد نهائي',ARCHIVED:'مؤرشف'};
 const statuses={not_due:'غير مستحق بعد',complete:'مستوفى',incomplete:'غير مستوفى',not_applicable:'لا ينطبق'};
 const methods={written:'امتحان تحريري',quizzes:'اختبارات قصيرة',assignments:'تكليفات',projects:'مشاريع',presentations:'عروض ومناقشات'};
 const activities={guest:'متحدث ضيف',visiting:'محاضر زائر',visit:'زيارة ميدانية',seminar:'ندوة علمية',workshop:'ورشة عمل',other:'أخرى'};
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dept=k=>root.CITLCourseDepartments?.[k]?.name||k||'يحتاج إسناد القسم';
 const stamp=v=>v?new Date(v).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}):'—';
 const csv=rows=>'\uFEFF'+rows.map(row=>row.map(v=>{v=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
 const editable=(w,c=0)=>w.offering.source_active&&w.offering.state!=='ARCHIVED'&&(c===17?w.roles.head&&w.offering.coordinator_id!==root.currentUser?.id&&['SUBMITTED_TO_DEPARTMENT','RETURNED_BY_EDUCATION_AFFAIRS'].includes(w.offering.state):['DRAFT','IN_PROGRESS','RETURNED_BY_DEPARTMENT','RETURNED_BY_EDUCATION_AFFAIRS'].includes(w.offering.state)&&(w.roles.coordinator||(w.roles.lecturer&&[0,7,8,13,15].includes(c))));
 root.CITLCoursesModel=Object.freeze({criteria,states,statuses,methods,activities,escape,dept,stamp,csv,editable});
})(window);
