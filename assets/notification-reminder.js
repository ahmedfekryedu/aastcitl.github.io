/* Reminder surfaces disabled by request. Inbox, bell and unread indicators remain unchanged.
 * Keep the existing public hooks for callers; no polling, requests or DOM changes. */
(function(root){
 'use strict';
 const disabled=Object.freeze({check:async()=>{},pauseForReview:()=>{}});
 root.CITLNotificationReminder=disabled;
 root.CITLPendingApprovalsReminder=disabled;
})(window);
