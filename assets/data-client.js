(function (root) {
  'use strict';
  async function rpc(client, name, args) {
    const controller = new AbortController();
    const notificationRead=['citl_notifications_view','citl_overdue_notifications'].includes(name);
    const timer = setTimeout(() => controller.abort(), notificationRead?25000:15000);
    try {
      const { data, error } = await client.rpc(name, args).abortSignal(controller.signal);
      if (controller.signal.aborted) throw Object.assign(new Error(notificationRead?'تأخر تحميل الإشعارات. سنحاول مرة أخرى تلقائيًا.':'انتهت مهلة الاتصال. لو كنت بتحفظ تغييرًا، حدّث البيانات للتأكد من نتيجته قبل تكراره.'),{code:'CITL_TIMEOUT'});
      if (error) {const service=/^CITL_SERVICE_MAINTENANCE:([a-z_]+)$/.exec(error.message||'');const label=service&&root.CITLServices?.decision(service[1])?.label;throw Object.assign(new Error(service?(label||'هذه الخدمة')+' قيد التحديث حاليًا':error.message || 'تعذر إتمام العملية'), { code: error.code });}
      if (!data || data.ok === false) throw new Error(data?.error || 'تعذر إتمام العملية');
      return data;
    } catch(error){if(notificationRead&&controller.signal.aborted)throw Object.assign(new Error('تأخر تحميل الإشعارات. سنحاول مرة أخرى تلقائيًا.'),{code:'CITL_TIMEOUT'});throw error;} finally { clearTimeout(timer); }
  }
  root.CITLRequests = Object.freeze({ rpc });
})(window);
