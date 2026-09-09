(function () {
  'use strict';
  const form = document.getElementById('signupForm');
  if (!form) return;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const errorBox = document.getElementById('signup-error');
    window.showLoader?.('جاري التحقق من الكود وإنشاء الحساب…');
    errorBox?.classList.add('hidden');
    try {
      const details = {
        full_name: document.getElementById('reg-name')?.value,
        mobile: document.getElementById('reg-mobile')?.value,
        email: document.getElementById('reg-email')?.value,
        department: document.getElementById('reg-dept')?.value,
        position: document.getElementById('reg-position')?.value,
        account_type: document.getElementById('reg-account-type')?.value,
        linked_instructor: document.getElementById('reg-linked-instructor')?.value,
      };
      const accessCode = document.getElementById('reg-access-code')?.value;
      const password = document.getElementById('reg-password')?.value;
      const { data: prepared, error: prepareError } = await window.sb.rpc('citl_prepare_registration', {
        p_access_code: accessCode,
        p_details: details,
      });
      if (prepareError || !prepared?.ticket) {
        throw new Error(prepareError?.message || prepared?.error || 'تعذر التحقق من كود التسجيل');
      }
      const { data: created, error: signupError } = await window.sb.auth.signUp({
        email: details.email,
        password,
        options: { data: { registration_ticket: prepared.ticket } },
      });
      if (signupError || !created?.user || created.user.identities?.length === 0) {
        throw new Error(signupError?.message || 'البريد مستخدم بالفعل أو تعذر إنشاء الحساب');
      }
      window.hideLoader?.();
      window.showSuccessModal?.();
    } catch (error) {
      window.hideLoader?.();
      if (errorBox) {
        errorBox.textContent = `تنبيه: ${error.message}`;
        errorBox.classList.remove('hidden');
      }
    }
  }, true);
})();
