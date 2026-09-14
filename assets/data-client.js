(function (root) {
  'use strict';
  async function rpc(client, name, args) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error } = await client.rpc(name, args).abortSignal(controller.signal);
      if (controller.signal.aborted) throw new Error('انتهت مهلة الاتصال. لو كنت بتحفظ تغييرًا، حدّث البيانات للتأكد من نتيجته قبل تكراره.');
      if (error) throw Object.assign(new Error(error.message || 'تعذر إتمام العملية'), { code: error.code });
      if (!data || data.ok === false) throw new Error(data?.error || 'تعذر إتمام العملية');
      return data;
    } finally { clearTimeout(timer); }
  }
  root.CITLRequests = Object.freeze({ rpc });
})(window);
