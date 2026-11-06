// Non-authentication UI tests isolate the form/layout workflow. access.test.cjs tests the real PIN UI.
exports.allowTestStaff=async context=>context.route('**/staff-access.js*',route=>route.fulfill({contentType:'text/javascript',body:'window.JWCStaffAccess={enabled:()=>false,getToken:()=>"unit-test-session",require:()=>Promise.resolve(true),forget(){}};'}));
