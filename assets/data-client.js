(function (root) {
  'use strict';
  async function rpc(client, name, args) {
    if(root.CITLAuthClient?.cooldown()>0)throw root.CITLAuthClient.retryError();
    const controller = new AbortController();
    const notificationRead=['citl_notifications_view','citl_overdue_notifications'].includes(name);
    const bulkEnrollment=name==='citl_visitors_bulk'&&args?.p_action==='apply';
    const timer = setTimeout(() => controller.abort(), bulkEnrollment?60000:notificationRead?25000:15000);
    try {
      const { data, error } = await client.rpc(name, args).abortSignal(controller.signal);
      if (controller.signal.aborted) throw Object.assign(new Error(notificationRead?'تأخر تحميل الإشعارات. سنحاول مرة أخرى تلقائيًا.':'انتهت مهلة الاتصال. لو كنت بتحفظ تغييرًا، حدّث البيانات للتأكد من نتيجته قبل تكراره.'),{code:'CITL_TIMEOUT'});
      if (error) {const service=/^CITL_SERVICE_MAINTENANCE:([a-z_]+)$/.exec(error.message||'');const label=service&&root.CITLServices?.decision(service[1])?.label;throw Object.assign(new Error(service?(label||'هذه الخدمة')+' قيد التحديث حاليًا':error.message || 'تعذر إتمام العملية'), { code: error.code });}
      if (!data || data.ok === false) throw new Error(data?.error || 'تعذر إتمام العملية');
      if(['citl_academic_review','citl_academic_admin','citl_room_swap_api','citl_secure_api','citl_admin_correct_registration','citl_registration_review_status','citl_visitors_bulk'].includes(name)&&args?.p_action&&!/^(read|get|list|overview|preview|notifications\.|.*\.list|.*\.get)/.test(args.p_action))root.dispatchEvent(new Event('citl-workflow-updated'));
      return data;
    } catch(error){if(notificationRead&&controller.signal.aborted)throw Object.assign(new Error('تأخر تحميل الإشعارات. سنحاول مرة أخرى تلقائيًا.'),{code:'CITL_TIMEOUT'});throw error;} finally { clearTimeout(timer); }
  }
  root.CITLRequests = Object.freeze({ rpc });
})(window);
