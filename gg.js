// ============================================
// SUPABASE CONNECTION
// ============================================
const SUPABASE_URL = 'https://hpqfsdgbppwlosltbemk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcWZzZGdicHB3bG9zbHRiZW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTA0NDYsImV4cCI6MjA5NjkyNjQ0Nn0.Qphtm4_wMlDEbPRyuR0_g-LxPc4AOu2ZFSIzAapBnOA';

let sbClient = null;
let useSupabase = false;
let supabaseInitialized = false;

// Initialize Supabase
(function initSupabase() {
  console.log('🔄 Initializing Supabase...');
  
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    try {
      sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      useSupabase = true;
      supabaseInitialized = true;
      console.log('✅ Supabase initialized successfully');
      console.log('🔗 Connected to:', SUPABASE_URL);
    } catch (e) {
      console.log('❌ Failed to create Supabase client:', e);
    }
  } else {
    console.log('⚠️ Supabase library not found, loading dynamically...');
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
    script.onload = function() {
      console.log('✅ Supabase library loaded dynamically');
      if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
          sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
          useSupabase = true;
          supabaseInitialized = true;
          console.log('✅ Supabase initialized successfully after dynamic load');
          
          if (window.location.pathname.includes('admin.html')) {
            setTimeout(function() {
              if (typeof window.loadAllUsersTable === 'function') {
                window.loadAllUsersTable();
              }
              if (typeof window.loadAllAppointments === 'function') {
                window.loadAllAppointments();
              }
            }, 500);
          }
        } catch (e) {
          console.log('❌ Failed to create Supabase client after dynamic load:', e);
        }
      }
    };
    script.onerror = function() {
      console.log('❌ Failed to load Supabase library');
    };
    document.head.appendChild(script);
  }
})();

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function isValidName(name) {
  const nameRegex = /^[A-Za-z\s\-']+$/;
  return nameRegex.test(name);
}

function isAtLeast18YearsOld(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

function getMaxBirthDate() {
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() - 18);
  return maxDate;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================
// SUPABASE FUNCTIONS
// ============================================

async function getUsers() {
  if (!useSupabase || !sbClient) {
    console.log('⚠️ Supabase not connected');
    showToast('❌ Database not connected', true);
    return [];
  }
  try {
    const { data, error } = await sbClient.from('users').select('*');
    if (!error && data) {
      console.log('📡 Loaded users from Supabase:', data.length);
      return data;
    } else {
      console.log('❌ Error loading users:', error);
      return [];
    }
  } catch (e) {
    console.log('Supabase error:', e);
    return [];
  }
}

async function saveUser(firstName, lastName, email, password, dob, userType = 'student') {
  if (!useSupabase || !sbClient) {
    showToast('❌ Database not connected', true);
    return null;
  }
  
  const newUser = {
    first_name: firstName,
    last_name: lastName,
    email: email,
    password: password,
    dob: dob,
    user_type: userType
  };
  
  try {
    const { data, error } = await sbClient.from('users').insert([newUser]).select();
    if (!error && data) {
      console.log('📡 Saved user to Supabase:', email);
      showToast('✅ Account created! Please login.');
      return data[0];
    } else {
      if (error && error.message && error.message.includes('duplicate')) {
        showToast('❌ Email already exists! Please use another email.', true);
      } else {
        showToast('❌ Error creating account: ' + (error?.message || 'Unknown error'), true);
      }
      return null;
    }
  } catch (e) {
    console.log('Supabase error:', e);
    showToast('❌ Database error. Please try again.', true);
    return null;
  }
}

async function loginUserAny(email, password) {
  if (!useSupabase || !sbClient) {
    showToast('❌ Database not connected', true);
    return null;
  }
  
  console.log('🔍 Checking login for:', email);
  
  try {
    const { data, error } = await sbClient
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password);
    
    if (!error && data && data.length > 0) {
      const userData = data[0];
      console.log('✅ User found:', userData);
      console.log('👤 User type:', userData.user_type);
      
      return {
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        password: userData.password,
        dob: userData.dob,
        userType: userData.user_type
      };
    } else {
      console.log('❌ No user found with those credentials');
      return null;
    }
  } catch (e) {
    console.log('Login error:', e);
    return null;
  }
}

async function loginUser(email, password, userType = 'student') {
  if (!useSupabase || !sbClient) {
    showToast('❌ Database not connected', true);
    return null;
  }
  
  try {
    const { data, error } = await sbClient
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('user_type', userType);
    
    if (!error && data && data.length > 0) {
      const userData = data[0];
      console.log('📡 Logged in from Supabase:', email);
      return {
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        password: userData.password,
        dob: userData.dob,
        userType: userData.user_type
      };
    } else {
      return null;
    }
  } catch (e) {
    console.log('Login error:', e);
    return null;
  }
}

async function getAllStudents() {
  if (!useSupabase || !sbClient) return [];
  try {
    const { data, error } = await sbClient
      .from('users')
      .select('*')
      .eq('user_type', 'student');
    
    if (!error && data) {
      console.log('📡 Loaded students from Supabase:', data.length);
      return data;
    }
    return [];
  } catch (e) {
    console.log('Error:', e);
    return [];
  }
}

async function getAllAdmins() {
  if (!useSupabase || !sbClient) return [];
  try {
    const { data, error } = await sbClient
      .from('users')
      .select('*')
      .eq('user_type', 'admin');
    
    if (!error && data) {
      console.log('📡 Loaded admins from Supabase:', data.length);
      return data;
    }
    return [];
  } catch (e) {
    console.log('Error:', e);
    return [];
  }
}

async function getAllUsersFull() {
  if (!useSupabase || !sbClient) return [];
  try {
    const { data, error } = await sbClient
      .from('users')
      .select('*');
    
    if (!error && data) {
      console.log('📡 Loaded all users from Supabase:', data.length);
      return data;
    }
    return [];
  } catch (e) {
    console.log('Error:', e);
    return [];
  }
}

async function deleteStudentAccount(email) {
  if (!useSupabase || !sbClient) return false;
  try {
    await sbClient.from('users').delete().eq('email', email);
    console.log('📡 Deleted student from Supabase:', email);
    showToast('✅ Student deleted');
    return true;
  } catch (e) {
    console.log('Delete error:', e);
    return false;
  }
}

// ============================================
// APPOINTMENT FUNCTIONS
// ============================================

async function getAppointments(userEmail) {
  if (!useSupabase || !sbClient) {
    console.log('⚠️ Supabase not connected, returning empty');
    return [];
  }
  
  try {
    const { data, error } = await sbClient
      .from('appointments')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('❌ Error fetching appointments:', error);
      return [];
    }
    
    console.log('📡 Loaded appointments from Supabase:', data.length);
    return data || [];
  } catch (e) {
    console.log('❌ Exception fetching appointments:', e);
    return [];
  }
}

async function getAllAppointments() {
  if (!useSupabase || !sbClient) {
    console.log('⚠️ Supabase not connected, returning empty');
    return [];
  }
  
  try {
    const { data, error } = await sbClient
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('❌ Error fetching all appointments:', error);
      return [];
    }
    
    console.log('📡 Loaded all appointments from Supabase:', data.length);
    return data || [];
  } catch (e) {
    console.log('❌ Exception fetching all appointments:', e);
    return [];
  }
}

async function deleteAppointmentById(appointmentId) {
  if (!useSupabase || !sbClient) {
    showToast('❌ Database not connected', true);
    return false;
  }
  
  try {
    const { error } = await sbClient
      .from('appointments')
      .delete()
      .eq('id', appointmentId);
    
    if (error) {
      console.log('❌ Error deleting appointment:', error);
      showToast('❌ Error deleting appointment', true);
      return false;
    }
    
    console.log('📡 Deleted appointment from Supabase:', appointmentId);
    showToast('✅ Appointment deleted successfully');
    return true;
  } catch (e) {
    console.log('❌ Exception deleting appointment:', e);
    showToast('❌ Database error. Please try again.', true);
    return false;
  }
}

async function saveAppointment(userEmail, date, time, type, message) {
  if (!useSupabase || !sbClient) {
    showToast('❌ Database not connected', true);
    return null;
  }
  
  const id = Date.now();
  
  const newAppointment = {
    id: id,
    user_email: userEmail,
    date: date,
    time: time,
    type: type,
    message: message,
    created_at: new Date().toISOString()
  };
  
  try {
    const { data, error } = await sbClient
      .from('appointments')
      .insert([newAppointment])
      .select();
    
    if (error) {
      console.log('❌ Error saving appointment:', error);
      showToast('❌ Error saving appointment: ' + error.message, true);
      return null;
    }
    
    console.log('📡 Saved appointment to Supabase:', data);
    showToast('✅ Appointment requested successfully!');
    return data[0];
  } catch (e) {
    console.log('❌ Exception saving appointment:', e);
    showToast('❌ Database error. Please try again.', true);
    return null;
  }
}

// ============================================
// UPDATE USER PROFILE
// ============================================
async function updateUserProfile(oldEmail, firstName, lastName, newEmail, dob, newPassword) {
  if (!useSupabase || !sbClient) {
    showToast('❌ Database not connected', true);
    return null;
  }
  
  console.log('📝 UPDATE: Updating profile in Supabase for:', oldEmail);
  
  const updateData = { 
    first_name: firstName, 
    last_name: lastName, 
    email: newEmail, 
    dob: dob 
  };
  if (newPassword) updateData.password = newPassword;
  
  console.log('📝 UPDATE: Data to send:', updateData);
  
  try {
    const { data, error } = await sbClient
      .from('users')
      .update(updateData)
      .eq('email', oldEmail)
      .select();
    
    if (error) {
      console.log('❌ UPDATE Error:', error);
      showToast('❌ Error updating profile: ' + error.message, true);
      return null;
    }
    
    console.log('✅ UPDATE Response:', data);
    
    if (data && data.length > 0) {
      console.log('✅ UPDATE Success: User updated in Supabase');
      showToast('✅ Profile updated successfully!');
      return data[0];
    }
    
    const { data: checkData, error: checkError } = await sbClient
      .from('users')
      .select('*')
      .eq('email', newEmail)
      .single();
    
    if (checkData) {
      console.log('✅ UPDATE: User found with new email:', checkData);
      showToast('✅ Profile updated successfully!');
      return checkData;
    }
    
    const { data: oldCheckData, error: oldCheckError } = await sbClient
      .from('users')
      .select('*')
      .eq('email', oldEmail)
      .single();
    
    if (oldCheckData) {
      console.log('⚠️ UPDATE: User still has old email, update may have failed silently');
      showToast('⚠️ Profile update may have failed. Please try again.', true);
      return null;
    }
    
    showToast('⚠️ User not found. Please try again.', true);
    return null;
    
  } catch (e) {
    console.log('❌ UPDATE Exception:', e);
    showToast('❌ Database error. Please try again.', true);
    return null;
  }
}

// ============================================
// COMMON UTILITIES
// ============================================
function showToast(message, isError = false) {
  const toast = document.getElementById('toastMsg');
  if (!toast) return;
  toast.textContent = message;
  toast.style.backgroundColor = isError ? '#922a2a' : '#1e5a48';
  toast.style.visibility = 'visible';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.visibility = 'hidden';
    }, 300);
  }, 2800);
}

// ============================================
// LANGUAGE TRANSLATIONS
// ============================================
const langTranslations = {
  en: {
    authTitle: 'Access Portal', authDesc: 'Login to your account or create new',
    rememberMe: 'Remember Me', forgotPassword: 'Forgot your password?',
    loginBtn: 'Login', signupBtn: 'Sign Up',
    adminAccess: '🔐 Admin Access', adminLoginBtn: 'Login as Admin',
    typingHeader: '✨ Concern and Suggestions ✨', sendBtn: 'Send',
    welcomeMsg: 'Welcome! Type something and click Send.',
    signupModalTitle: 'Create Student Account', firstNamePlaceholder: 'First Name',
    lastNamePlaceholder: 'Last Name', emailPlaceholder: 'Gmail Address (must end with @gmail.com)',
    passwordPlaceholder: 'Password', passwordReq: 'Password must contain:',
    reqLength: '✓ At least 8 characters', reqNumber: '✓ At least 1 number',
    reqLetter: '✓ At least 1 letter', reqSymbol: '✓ At least 1 symbol (!@#$%^&*)',
    registerBtn: 'Register Student', adminModalTitle: 'Admin Login',
    adminEmailPlaceholder: 'Admin Email', adminPasswordPlaceholder: 'Admin Password',
    adminLoginModalBtn: 'Login as Admin', toastEnglish: '🌐 Language set to English',
    toastBisaya: '🇵🇭 Gipili ang pinulongang Bisaya', toastTagalog: '🇵🇭 Napili ang wikang Tagalog',
    errorNameNumbers: '❌ Name cannot contain numbers or special characters',
    errorAgeTooYoung: '❌ You must be at least 18 years old to register'
  },
  bisaya: {
    authTitle: 'Pagsulod sa Portal', authDesc: 'Pag-login sa imong account o paghimo og bag-o',
    rememberMe: 'Hinumdumi Ko', forgotPassword: 'Nakalimot sa password?',
    loginBtn: 'Pagsulod', signupBtn: 'Pagparehistro',
    adminAccess: '🔐 Pag-access sa Admin', adminLoginBtn: 'Pagsulod isip Admin',
    typingHeader: '✨ Kabalaka ug mga Suhestyon ✨', sendBtn: 'Ipadala',
    welcomeMsg: 'Maayong pag-abot! Pag-type og butang dayon i-click ang Ipadala.',
    signupModalTitle: 'Paghimo og Account sa Estudyante', firstNamePlaceholder: 'Pangalan',
    lastNamePlaceholder: 'Apelyido', emailPlaceholder: 'Gmail Address (kinahanglan @gmail.com)',
    passwordPlaceholder: 'Password', passwordReq: 'Ang password kinahanglan adunay:',
    reqLength: '✓ Labing menos 8 ka karakter', reqNumber: '✓ Labing menos 1 ka numero',
    reqLetter: '✓ Labing menos 1 ka letra', reqSymbol: '✓ Labing menos 1 ka simbolo (!@#$%^&*)',
    registerBtn: 'Magparehistro', adminModalTitle: 'Pagsulod sa Admin',
    adminEmailPlaceholder: 'Email sa Admin', adminPasswordPlaceholder: 'Password sa Admin',
    adminLoginModalBtn: 'Pagsulod isip Admin', toastEnglish: '🌐 Gipili ang pinulongang English',
    toastBisaya: '🇵🇭 Gipili ang pinulongang Bisaya', toastTagalog: '🇵🇭 Gipili ang pinulongang Tagalog',
    errorNameNumbers: '❌ Dili pwede ang numero o special character sa ngalan',
    errorAgeTooYoung: '❌ Kinahanglan 18 anyos pataas aron maka-rehistro'
  },
  tagalog: {
    authTitle: 'Pumasok sa Portal', authDesc: 'Mag-login sa iyong account o gumawa ng bago',
    rememberMe: 'Tandaan Ako', forgotPassword: 'Nakalimutan ang password?',
    loginBtn: 'Mag-login', signupBtn: 'Mag-sign Up',
    adminAccess: '🔐 Admin Access', adminLoginBtn: 'Mag-login bilang Admin',
    typingHeader: '✨ Alalahanin at Mungkahi ✨', sendBtn: 'Ipadala',
    welcomeMsg: 'Maligayang pagdating! Mag-type ng isang bagay at i-click ang Ipadala.',
    signupModalTitle: 'Gumawa ng Estudyanteng Account', firstNamePlaceholder: 'Pangalan',
    lastNamePlaceholder: 'Apelyido', emailPlaceholder: 'Gmail Address (dapat @gmail.com)',
    passwordPlaceholder: 'Password', passwordReq: 'Ang password ay dapat mayroong:',
    reqLength: '✓ Hindi bababa sa 8 character', reqNumber: '✓ Hindi bababa sa 1 numero',
    reqLetter: '✓ Hindi bababa sa 1 letra', reqSymbol: '✓ Hindi bababa sa 1 simbolo (!@#$%^&*)',
    registerBtn: 'Magrehistro', adminModalTitle: 'Admin Login',
    adminEmailPlaceholder: 'Admin Email', adminPasswordPlaceholder: 'Admin Password',
    adminLoginModalBtn: 'Mag-login bilang Admin', toastEnglish: '🌐 Napili ang wikang English',
    toastBisaya: '🇵🇭 Napili ang wikang Bisaya', toastTagalog: '🇵🇭 Napili ang wikang Tagalog',
    errorNameNumbers: '❌ Hindi pwede ang numero o special character sa pangalan',
    errorAgeTooYoung: '❌ Kailangan hindi bababa sa 18 taong gulang upang magrehistro'
  }
};

let currentLang = 'en';

function updateUILanguage(lang) {
  currentLang = lang;
  const t = langTranslations[lang];
  
  const elements = {
    authTitle: document.getElementById('authTitle'),
    authDesc: document.getElementById('authDesc'),
    rememberMeText: document.getElementById('rememberMeText'),
    forgotPwdText: document.getElementById('forgotPwdLink'),
    loginBtnText: document.getElementById('loginBtnText'),
    signupBtnText: document.getElementById('signupBtnText'),
    adminAccessText: document.getElementById('adminAccessText'),
    adminLoginBtnText: document.getElementById('adminLoginBtnText'),
    typingHeaderText: document.getElementById('typingHeaderText'),
    sendBtnText: document.getElementById('sendBtnText'),
    welcomeMsgText: document.getElementById('welcomeMsgText'),
    signupModalTitle: document.getElementById('signupModalTitle'),
    firstNameInput: document.getElementById('signupFirstName'),
    lastNameInput: document.getElementById('signupLastName'),
    signupEmailInput: document.getElementById('signupEmail'),
    signupPasswordInput: document.getElementById('signupPassword'),
    passwordReqText: document.getElementById('passwordReqText'),
    registerBtnText: document.getElementById('registerBtnText'),
    adminModalTitle: document.getElementById('adminModalTitle'),
    adminEmailInput: document.getElementById('adminEmail'),
    adminPasswordInput: document.getElementById('adminPassword'),
    adminLoginModalBtnText: document.getElementById('adminLoginModalBtnText')
  };
  
  const reqElements = ['reqLength', 'reqNumber', 'reqLetter', 'reqSymbol'];
  
  if (elements.authTitle) elements.authTitle.innerHTML = `<i class="fas fa-graduation-cap"></i> ${t.authTitle}`;
  if (elements.authDesc) elements.authDesc.innerText = t.authDesc;
  if (elements.rememberMeText) elements.rememberMeText.innerText = t.rememberMe;
  if (elements.forgotPwdText) elements.forgotPwdText.innerText = t.forgotPassword;
  if (elements.loginBtnText) elements.loginBtnText.innerText = t.loginBtn;
  if (elements.signupBtnText) elements.signupBtnText.innerText = t.signupBtn;
  if (elements.adminAccessText) elements.adminAccessText.innerText = t.adminAccess;
  if (elements.adminLoginBtnText) elements.adminLoginBtnText.innerText = t.adminLoginBtn;
  if (elements.typingHeaderText) elements.typingHeaderText.innerText = t.typingHeader;
  if (elements.sendBtnText) elements.sendBtnText.innerText = t.sendBtn;
  if (elements.welcomeMsgText) elements.welcomeMsgText.innerText = t.welcomeMsg;
  if (elements.signupModalTitle) elements.signupModalTitle.innerHTML = `<i class="fas fa-user-graduate"></i> ${t.signupModalTitle}`;
  if (elements.firstNameInput) elements.firstNameInput.placeholder = t.firstNamePlaceholder;
  if (elements.lastNameInput) elements.lastNameInput.placeholder = t.lastNamePlaceholder;
  if (elements.signupEmailInput) elements.signupEmailInput.placeholder = t.emailPlaceholder;
  if (elements.signupPasswordInput) elements.signupPasswordInput.placeholder = t.passwordPlaceholder;
  if (elements.passwordReqText) elements.passwordReqText.innerText = t.passwordReq;
  if (elements.registerBtnText) elements.registerBtnText.innerText = t.registerBtn;
  if (elements.adminModalTitle) elements.adminModalTitle.innerHTML = `<i class="fas fa-user-shield"></i> ${t.adminModalTitle}`;
  if (elements.adminEmailInput) elements.adminEmailInput.placeholder = t.adminEmailPlaceholder;
  if (elements.adminPasswordInput) elements.adminPasswordInput.placeholder = t.adminPasswordPlaceholder;
  if (elements.adminLoginModalBtnText) elements.adminLoginModalBtnText.innerText = t.adminLoginModalBtn;
  
  reqElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = t[id];
  });
  
  if (lang === 'en') showToast(t.toastEnglish);
  else if (lang === 'bisaya') showToast(t.toastBisaya);
  else if (lang === 'tagalog') showToast(t.toastTagalog);
}

// ============================================
// PASSWORD TOGGLE
// ============================================
function setupPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  if (!toggle || !input) return;
  toggle.addEventListener('mousedown', () => input.type = 'text');
  toggle.addEventListener('mouseup', () => input.type = 'password');
  toggle.addEventListener('mouseleave', () => input.type = 'password');
}

// ============================================
// VALIDATION HELPERS
// ============================================
function validateGmail(email, errorId) {
  const errorDiv = document.getElementById(errorId);
  if (!email) {
    if (errorDiv) errorDiv.textContent = '';
    return false;
  }
  if (!email.endsWith('@gmail.com')) {
    if (errorDiv) errorDiv.textContent = currentLang === 'en' ? '❌ Email must be a Gmail address (@gmail.com)' : (currentLang === 'bisaya' ? '❌ Ang email kinahanglan Gmail address (@gmail.com)' : '❌ Ang email ay dapat Gmail address (@gmail.com)');
    return false;
  }
  if (errorDiv) errorDiv.textContent = '';
  return true;
}

function validatePasswordStrength(password) {
  return {
    isValid: password.length >= 8 && /[0-9]/.test(password) && /[A-Za-z]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
}

function updatePasswordRequirements(password) {
  const ids = ['reqLength', 'reqNumber', 'reqLetter', 'reqSymbol'];
  const checks = [
    password.length >= 8,
    /[0-9]/.test(password),
    /[A-Za-z]/.test(password),
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  ];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.color = checks[i] ? '#28a745' : '#999';
  });
}

// ============================================
// LANDING PAGE LOGIC
// ============================================
(function initLandingPage() {
  const pagePath = window.location.pathname;
  // Updated to check for index.html instead of gg.html
  if (pagePath.includes('index.html') || pagePath === '/' || pagePath.endsWith('/') || (!pagePath.includes('dashboard') && !pagePath.includes('admin'))) {
    
    setupPasswordToggle('toggleLoginPassword', 'loginPassword');
    setupPasswordToggle('toggleSignupPassword', 'signupPassword');
    setupPasswordToggle('toggleAdminPassword', 'adminPassword');

    const loginEmailField = document.getElementById('loginEmail');
    const signupPasswordField = document.getElementById('signupPassword');
    const signupEmailField = document.getElementById('signupEmail');
    const firstNameField = document.getElementById('signupFirstName');
    const lastNameField = document.getElementById('signupLastName');
    const dobField = document.getElementById('signupDob');
    
    const maxDate = getMaxBirthDate();
    const formattedMaxDate = formatDateForInput(maxDate);
    if (dobField) {
      dobField.setAttribute('max', formattedMaxDate);
    }
    
    if (firstNameField) {
      firstNameField.addEventListener('input', function() {
        this.value = this.value.replace(/[^A-Za-z\s\-']/g, '');
      });
    }
    if (lastNameField) {
      lastNameField.addEventListener('input', function() {
        this.value = this.value.replace(/[^A-Za-z\s\-']/g, '');
      });
    }
    
    if (loginEmailField) {
      loginEmailField.addEventListener('input', function() { validateGmail(this.value, 'loginEmailError'); });
    }
    if (signupPasswordField) {
      signupPasswordField.addEventListener('input', function() { updatePasswordRequirements(this.value); });
    }
    if (signupEmailField) {
      signupEmailField.addEventListener('input', function() { validateGmail(this.value, 'signupEmailError'); });
    }

    const langEn = document.getElementById('langEn');
    const langBisaya = document.getElementById('langBisaya');
    const langTagalog = document.getElementById('langTagalog');
    
    if (langEn) langEn.addEventListener('click', () => updateUILanguage('en'));
    if (langBisaya) langBisaya.addEventListener('click', () => updateUILanguage('bisaya'));
    if (langTagalog) langTagalog.addEventListener('click', () => updateUILanguage('tagalog'));

    const signupModal = document.getElementById('signupModal');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const closeModalBtn = document.querySelector('.close-modal');
    
    if (showSignupBtn) {
      showSignupBtn.addEventListener('click', function() { if (signupModal) signupModal.style.display = 'block'; });
    }
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', function() { if (signupModal) signupModal.style.display = 'none'; });
    }
    window.addEventListener('click', function(e) {
      if (e.target === signupModal && signupModal) signupModal.style.display = 'none';
    });

    // REGISTER
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', async function() {
        const firstName = document.getElementById('signupFirstName').value.trim();
        const lastName = document.getElementById('signupLastName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const dob = document.getElementById('signupDob').value;
        
        if (!firstName || !lastName) {
          showToast('❌ Please enter first and last name', true);
          return;
        }
        if (!isValidName(firstName)) {
          showToast(langTranslations[currentLang].errorNameNumbers, true);
          return;
        }
        if (!isValidName(lastName)) {
          showToast(langTranslations[currentLang].errorNameNumbers, true);
          return;
        }
        if (!validateGmail(email, 'signupEmailError')) {
          showToast('❌ Please use a valid Gmail address', true);
          return;
        }
        if (!validatePasswordStrength(password).isValid) {
          showToast('❌ Password must have 8+ chars, 1 number, 1 letter, and 1 symbol', true);
          return;
        }
        if (!dob) {
          showToast('❌ Please enter your date of birth', true);
          return;
        }
        if (!isAtLeast18YearsOld(dob)) {
          showToast(langTranslations[currentLang].errorAgeTooYoung, true);
          return;
        }
        
        const existingUsers = await getUsers();
        if (existingUsers.find(function(u) { return u.email === email; })) {
          showToast('❌ Account already exists. Please login.', true);
          return;
        }
        
        const newUser = await saveUser(firstName, lastName, email, password, dob, 'student');
        if (newUser) {
          if (signupModal) signupModal.style.display = 'none';
          const loginEmailEl = document.getElementById('loginEmail');
          if (loginEmailEl) loginEmailEl.value = email;
          
          document.getElementById('signupFirstName').value = '';
          document.getElementById('signupLastName').value = '';
          document.getElementById('signupEmail').value = '';
          document.getElementById('signupPassword').value = '';
          document.getElementById('signupDob').value = '';
        }
      });
    }

    // SINGLE LOGIN
    const loginButton = document.getElementById('loginBtn');
    if (loginButton) {
      loginButton.addEventListener('click', async function() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMeCheck').checked;
        
        if (!validateGmail(email, 'loginEmailError')) {
          showToast('❌ Enter valid Gmail', true);
          return;
        }
        if (!password) {
          showToast('❌ Enter your password', true);
          return;
        }
        
        const user = await loginUserAny(email, password);
        
        if (user) {
          console.log('✅ User found in Supabase:', user);
          console.log('👤 User type:', user.userType);
          
          if (user.userType === 'admin') {
            showToast('✅ Welcome Admin, ' + user.firstName + '!');
            localStorage.setItem('isAdminLoggedIn', 'true');
            localStorage.removeItem('currentUser');
            if (rememberMe) localStorage.setItem('rememberedUser', email);
            else localStorage.removeItem('rememberedUser');
            setTimeout(function() {
              window.location.href = 'admin.html';
            }, 1500);
            return;
          } else if (user.userType === 'student') {
            showToast('✅ Welcome back, ' + user.firstName + '!');
            if (rememberMe) localStorage.setItem('rememberedUser', email);
            else localStorage.removeItem('rememberedUser');
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.removeItem('isAdminLoggedIn');
            setTimeout(function() {
              window.location.href = 'dashboard.html';
            }, 1500);
            return;
          }
        }
        
        const ADMIN_EMAIL = 'godwynebacor@gmail.com';
        const ADMIN_PASSWORD = 'godwynebacor1';
        
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          showToast('✅ Admin login successful!');
          localStorage.setItem('isAdminLoggedIn', 'true');
          localStorage.removeItem('currentUser');
          if (rememberMe) localStorage.setItem('rememberedUser', email);
          else localStorage.removeItem('rememberedUser');
          setTimeout(function() {
            window.location.href = 'admin.html';
          }, 1500);
          return;
        }
        
        showToast('❌ Invalid email or password. Please try again or sign up.', true);
      });
    }

    // Remember Me
    const rememberedEmail = localStorage.getItem('rememberedUser');
    if (rememberedEmail && document.getElementById('loginEmail')) {
      document.getElementById('loginEmail').value = rememberedEmail;
      const rememberCheckbox = document.getElementById('rememberMeCheck');
      if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    const forgotPasswordLink = document.getElementById('forgotPwdLink');
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        showToast('📧 Password reset link sent to your email (demo)');
      });
    }

    const typingInput = document.getElementById('typeInput');
    const sendButton = document.getElementById('sendTypeBtn');
    const messageDiv = document.getElementById('dynamicMsg');
    
    if (sendButton && typingInput && messageDiv) {
      sendButton.addEventListener('click', function() {
        const typedValue = typingInput.value;
        if (typedValue.trim() === '') {
          messageDiv.innerHTML = currentLang === 'en' ? '<i class="fas fa-info-circle"></i> Please write something!' : (currentLang === 'bisaya' ? '<i class="fas fa-info-circle"></i> Palihog pagsulat og usa ka butang!' : '<i class="fas fa-info-circle"></i> Pakisulat ng isang bagay!');
        } else {
          messageDiv.innerHTML = '<i class="fas fa-pen-fancy"></i> "' + typedValue.substring(0, 100) + '" — ' + (currentLang === 'en' ? 'Thanks for sharing!' : (currentLang === 'bisaya' ? 'Salamat sa pag-ambit!' : 'Salamat sa pagbabahagi!'));
          typingInput.value = '';
        }
      });
      typingInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendButton.click();
      });
    }

    updateUILanguage('en');
    console.log('✅ BACOR UNIVERSITY portal ready!');
  }
})();

// ============================================
// STUDENT DASHBOARD LOGIC
// ============================================
(function initStudentDashboard() {
  if (!window.location.pathname.includes('dashboard.html')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'index.html'; // Updated from gg.html
    return;
  }
  
  if (currentUser.userType === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  console.log('✅ Student dashboard loaded for:', currentUser.firstName);

  const sidebarName = document.getElementById('sidebarName');
  const sidebarEmail = document.getElementById('sidebarEmail');
  const sidebarDob = document.getElementById('sidebarDob');
  const sidebarId = document.getElementById('sidebarId');
  
  if (sidebarName) sidebarName.textContent = currentUser.firstName + ' ' + currentUser.lastName;
  if (sidebarEmail) sidebarEmail.textContent = currentUser.email;
  if (sidebarDob) sidebarDob.textContent = currentUser.dob || 'Not provided';
  
  let hashValue = 0;
  for (let i = 0; i < currentUser.email.length; i++) {
    hashValue = ((hashValue << 5) - hashValue) + currentUser.email.charCodeAt(i);
    hashValue = hashValue & hashValue;
  }
  if (sidebarId) sidebarId.textContent = 'STU' + Math.abs(hashValue).toString().substring(0, 8);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ACADEMIC CALENDAR
  let academicCalendarDate = new Date();
  const academicMonthYear = document.getElementById('academicMonthYear');
  const academicCalendarDays = document.getElementById('academicCalendarDays');
  const academicPrevBtn = document.getElementById('academicPrevBtn');
  const academicNextBtn = document.getElementById('academicNextBtn');
  
  function renderAcademicCalendar() {
    const year = academicCalendarDate.getFullYear();
    const month = academicCalendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    if (academicMonthYear) academicMonthYear.textContent = monthsList[month] + ' ' + year;
    if (!academicCalendarDays) return;
    academicCalendarDays.innerHTML = '';
    
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.classList.add('calendar-day-cell', 'empty');
      academicCalendarDays.appendChild(emptyCell);
    }
    
    const todayDate = new Date();
    for (let d = 1; d <= totalDays; d++) {
      const dayCell = document.createElement('div');
      dayCell.classList.add('calendar-day-cell');
      dayCell.textContent = weekdays[new Date(year, month, d).getDay()] + ' ' + d;
      if (todayDate.getMonth() === month && todayDate.getFullYear() === year && d === todayDate.getDate()) {
        dayCell.classList.add('today');
      }
      academicCalendarDays.appendChild(dayCell);
    }
  }
  
  renderAcademicCalendar();
  if (academicPrevBtn) {
    academicPrevBtn.addEventListener('click', function() {
      academicCalendarDate.setMonth(academicCalendarDate.getMonth() - 1);
      renderAcademicCalendar();
    });
  }
  if (academicNextBtn) {
    academicNextBtn.addEventListener('click', function() {
      academicCalendarDate.setMonth(academicCalendarDate.getMonth() + 1);
      renderAcademicCalendar();
    });
  }

  // APPOINTMENT SYSTEM
  let selectedAppointmentDate = null;
  let selectedTimeSlot = null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let appointmentCalendarDate = new Date();
  const appointmentMonthYear = document.getElementById('appointmentMonthYear');
  const appointmentCalendarDays = document.getElementById('appointmentCalendarDays');
  const selectedDateInfo = document.getElementById('selectedDateInfo');
  const appointmentType = document.getElementById('appointmentType');
  const appointmentMessage = document.getElementById('appointmentMessage');
  const submitAppointmentBtn = document.getElementById('submitAppointmentBtn');
  const appointmentsList = document.getElementById('appointmentsList');
  const appointmentError = document.getElementById('appointmentError');
  const appointmentErrorText = document.getElementById('appointmentErrorText');
  
  function selectAppointmentDate(date) {
    selectedAppointmentDate = date;
    selectedTimeSlot = null;
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (selectedDateInfo) selectedDateInfo.innerHTML = `<i class="fas fa-calendar-check"></i> Selected Date: ${date.toLocaleDateString('en-US', dateOptions)}`;
    document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
    if (appointmentError) appointmentError.style.display = 'none';
    renderAppointmentCalendar();
  }
  
  function renderAppointmentCalendar() {
    const year = appointmentCalendarDate.getFullYear();
    const month = appointmentCalendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    if (appointmentMonthYear) appointmentMonthYear.textContent = `${monthsList[month]} ${year}`;
    if (!appointmentCalendarDays) return;
    appointmentCalendarDays.innerHTML = '';
    
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement('div');
      emptyDiv.classList.add('calendar-day-cell', 'empty');
      appointmentCalendarDays.appendChild(emptyDiv);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayName = weekdays[date.getDay()];
      const dayDiv = document.createElement('div');
      dayDiv.classList.add('calendar-day-cell');
      dayDiv.textContent = `${dayName} ${day}`;
      
      const compareDate = new Date(year, month, day);
      compareDate.setHours(0, 0, 0, 0);
      
      if (compareDate < today) {
        dayDiv.classList.add('disabled');
        dayDiv.style.cursor = 'not-allowed';
      } else {
        if (compareDate.getTime() === today.getTime()) dayDiv.classList.add('today');
        if (selectedAppointmentDate && compareDate.toDateString() === selectedAppointmentDate.toDateString()) {
          dayDiv.classList.add('selected-date');
        }
        dayDiv.addEventListener('click', () => {
          if (compareDate < today) {
            showToast('❌ Cannot select past dates!', true);
            return;
          }
          selectAppointmentDate(compareDate);
          renderAppointmentCalendar();
        });
      }
      appointmentCalendarDays.appendChild(dayDiv);
    }
  }
  
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('click', function() {
      if (!selectedAppointmentDate) {
        showToast('❌ Please select a date first!', true);
        return;
      }
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      this.classList.add('selected');
      selectedTimeSlot = this.getAttribute('data-time');
      if (appointmentError) appointmentError.style.display = 'none';
    });
  });
  
  if (appointmentType) {
    appointmentType.addEventListener('change', function() {
      if (appointmentError) appointmentError.style.display = 'none';
    });
  }
  if (appointmentMessage) {
    appointmentMessage.addEventListener('input', function() {
      if (appointmentError) appointmentError.style.display = 'none';
    });
  }
  
  async function loadAppointments() {
    if (!appointmentsList) return;
    
    try {
      const appointments = await getAppointments(currentUser.email);
      
      if (appointments.length === 0) {
        appointmentsList.innerHTML = '<p style="color: #6c757d; font-size: 0.8rem; text-align: center; padding: 1rem;">📅 No appointments yet. Click a date above to schedule!</p>';
      } else {
        appointmentsList.innerHTML = appointments.map((apt) => `
          <div class="appointment-item" data-id="${apt.id}">
            <div class="appointment-info">
              <div class="appointment-date-time">📅 ${apt.date} | ⏰ ${apt.time}</div>
              <div class="appointment-type">📌 ${apt.type}</div>
              <div class="appointment-message-preview">${apt.message ? apt.message.substring(0, 80) : ''}${apt.message && apt.message.length > 80 ? '...' : ''}</div>
            </div>
            <button class="delete-appt" data-id="${apt.id}"><i class="fas fa-trash"></i></button>
          </div>
        `).join('');
      }
      
      document.querySelectorAll('.delete-appt').forEach(btn => {
        btn.removeEventListener('click', handleDelete);
        btn.addEventListener('click', handleDelete);
      });
    } catch (error) {
      console.log('Error loading appointments:', error);
      appointmentsList.innerHTML = '<p style="color: #dc3545; font-size: 0.8rem; text-align: center; padding: 1rem;">❌ Error loading appointments</p>';
    }
  }
  
  async function handleDelete(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const appointmentId = btn.getAttribute('data-id');
    
    if (!appointmentId) {
      showToast('❌ Error: Appointment ID not found', true);
      return;
    }
    
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }
    
    const success = await deleteAppointmentById(parseInt(appointmentId));
    if (success) {
      await loadAppointments();
      renderAppointmentCalendar();
    }
  }
  
  if (submitAppointmentBtn) {
    submitAppointmentBtn.addEventListener('click', async function() {
      if (appointmentError) appointmentError.style.display = 'none';
      
      if (!selectedAppointmentDate) {
        if (appointmentError) {
          appointmentError.style.display = 'block';
          appointmentErrorText.textContent = '❌ Please select a date from the Appointment Calendar!';
        }
        return;
      }
      
      if (!selectedTimeSlot) {
        if (appointmentError) {
          appointmentError.style.display = 'block';
          appointmentErrorText.textContent = '❌ Please select a time slot!';
        }
        return;
      }
      
      if (!appointmentType || appointmentType.value === '') {
        if (appointmentError) {
          appointmentError.style.display = 'block';
          appointmentErrorText.textContent = '❌ Please select an appointment type!';
        }
        return;
      }
      
      if (!appointmentMessage || !appointmentMessage.value.trim()) {
        if (appointmentError) {
          appointmentError.style.display = 'block';
          appointmentErrorText.textContent = '❌ Please describe your reason for the appointment!';
        }
        return;
      }
      
      const dateStr = selectedAppointmentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const saved = await saveAppointment(
        currentUser.email, 
        dateStr, 
        selectedTimeSlot, 
        appointmentType.value, 
        appointmentMessage.value.trim()
      );
      
      if (saved) {
        selectedAppointmentDate = null;
        selectedTimeSlot = null;
        if (selectedDateInfo) selectedDateInfo.innerHTML = '<i class="fas fa-info-circle"></i> Click on a date in the Appointment Calendar to select';
        if (appointmentMessage) appointmentMessage.value = '';
        if (appointmentType) appointmentType.value = '';
        document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
        if (appointmentError) appointmentError.style.display = 'none';
        await loadAppointments();
        renderAppointmentCalendar();
      }
    });
  }
  
  if (appointmentCalendarDays) {
    renderAppointmentCalendar();
    loadAppointments();
  }

  // ============================================
  // SETTINGS PANEL
  // ============================================
  const settingsPanel = document.getElementById('settingsPanel');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsPanel');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  
  const editFirstName = document.getElementById('editFirstName');
  const editLastName = document.getElementById('editLastName');
  const editEmail = document.getElementById('editEmail');
  const editDob = document.getElementById('editDob');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const accountInfo = document.getElementById('accountInfo');
  
  function populateSettingsFields() {
    if (editFirstName) editFirstName.value = currentUser.firstName;
    if (editLastName) editLastName.value = currentUser.lastName;
    if (editEmail) editEmail.value = currentUser.email;
    if (editDob) editDob.value = currentUser.dob || '';
    if (accountInfo) accountInfo.innerHTML = `📋 Student ID: STU${Math.abs(hashValue).toString().substring(0, 8)}<br>📅 Member since: ${new Date().toLocaleDateString()}`;
  }
  populateSettingsFields();
  
  window.enableField = function(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
      field.disabled = false;
      field.focus();
      field.style.background = 'white';
      field.style.borderColor = '#1a6b58';
    }
  };
  
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', function() {
      populateSettingsFields();
      if (settingsPanel) settingsPanel.style.display = 'flex';
    });
  }
  
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', function() {
      if (settingsPanel) settingsPanel.style.display = 'none';
    });
  }
  
  window.addEventListener('click', function(e) {
    if (e.target === settingsPanel) {
      settingsPanel.style.display = 'none';
    }
  });
  
  // SAVE SETTINGS
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async function() {
      const newFirstName = editFirstName.value.trim();
      const newLastName = editLastName.value.trim();
      const newEmail = editEmail.value.trim();
      const newDob = editDob.value;
      const newPass = newPassword.value;
      const confirmPass = confirmPassword.value;
      
      if (!newFirstName || !newLastName || !newEmail || !newDob) {
        showToast('❌ Please fill all profile fields', true);
        return;
      }
      
      if (newPass && newPass !== confirmPass) {
        showToast('❌ Passwords do not match', true);
        return;
      }
      
      if (!isValidName(newFirstName) || !isValidName(newLastName)) {
        showToast('❌ Names cannot contain numbers or special characters', true);
        return;
      }
      
      if (!validateGmail(newEmail, null)) {
        showToast('❌ Please use a valid Gmail address (@gmail.com)', true);
        return;
      }
      
      saveSettingsBtn.disabled = true;
      saveSettingsBtn.textContent = '⏳ Saving...';
      
      try {
        console.log('🔧 SAVE: Starting profile update...');
        console.log('🔧 SAVE: Old email:', currentUser.email);
        console.log('🔧 SAVE: New data:', { newFirstName, newLastName, newEmail, newDob });
        
        const updated = await updateUserProfile(
          currentUser.email, 
          newFirstName, 
          newLastName, 
          newEmail, 
          newDob, 
          newPass || undefined
        );
        
        if (updated) {
          console.log('✅ SAVE: Update successful!', updated);
          
          currentUser.firstName = newFirstName;
          currentUser.lastName = newLastName;
          currentUser.email = newEmail;
          currentUser.dob = newDob;
          if (newPass) currentUser.password = newPass;
          
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          
          if (sidebarName) sidebarName.textContent = newFirstName + ' ' + newLastName;
          if (sidebarEmail) sidebarEmail.textContent = newEmail;
          if (sidebarDob) sidebarDob.textContent = newDob;
          
          let newHash = 0;
          for (let i = 0; i < newEmail.length; i++) {
            newHash = ((newHash << 5) - newHash) + newEmail.charCodeAt(i);
            newHash = newHash & newHash;
          }
          if (sidebarId) sidebarId.textContent = 'STU' + Math.abs(newHash).toString().substring(0, 8);
          if (accountInfo) accountInfo.innerHTML = `📋 Student ID: STU${Math.abs(newHash).toString().substring(0, 8)}<br>📅 Member since: ${new Date().toLocaleDateString()}`;
          
          showToast('✅ Profile updated successfully in Supabase!');
          if (settingsPanel) settingsPanel.style.display = 'none';
          if (newPassword) newPassword.value = '';
          if (confirmPassword) confirmPassword.value = '';
        } else {
          console.log('❌ SAVE: Update returned null');
          showToast('❌ Error updating profile. Please try again.', true);
        }
      } catch (error) {
        console.error('❌ SAVE: Error:', error);
        showToast('❌ Error updating profile. Please try again.', true);
      } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = '💾 Save Changes';
      }
    });
  }

  const logoutTopBtn = document.getElementById('logoutTopBtn');
  if (logoutTopBtn) {
    logoutTopBtn.addEventListener('click', function() {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isAdminLoggedIn');
      window.location.href = 'index.html'; // Updated from gg.html
    });
  }
  
  console.log('✅ Student dashboard fully loaded');
})();

// ============================================
// ADMIN DASHBOARD LOGIC
// ============================================
(function initAdminDashboard() {
  if (window.location.pathname.includes('admin.html')) {
    const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn');
    if (!isAdminLoggedIn) {
      window.location.href = 'index.html'; // Updated from gg.html
      return;
    }
    
    console.log('✅ Admin dashboard loaded');
    
    const currentMonthEl = document.getElementById('currentMonth');
    if (currentMonthEl) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      currentMonthEl.textContent = monthNames[new Date().getMonth()];
    }
    
    // ============================================
    // TAB SWITCHING
    // ============================================
    const tabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const tabId = this.getAttribute('data-tab');
        tabContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById('tab-' + tabId);
        if (targetContent) targetContent.classList.add('active');
        
        // Load data for the tab
        if (tabId === 'users') {
          if (window.loadAllUsersTable) window.loadAllUsersTable();
        } else if (tabId === 'appointments') {
          if (window.loadAllAppointments) window.loadAllAppointments();
        }
      });
    });
    
    // ============================================
    // LOAD USERS TABLE
    // ============================================
    window.loadAllUsersTable = async function() {
      console.log('🔄 Loading all users from Supabase...');
      
      if (!useSupabase || !sbClient) {
        console.log('⚠️ Supabase not ready, trying to initialize...');
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
          try {
            sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            useSupabase = true;
            console.log('✅ Supabase initialized successfully in admin');
          } catch (e) {
            console.log('❌ Failed to initialize Supabase in admin:', e);
          }
        } else {
          console.log('❌ Supabase library not available');
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
          script.onload = function() {
            console.log('✅ Supabase library loaded in admin');
            if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
              try {
                sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                useSupabase = true;
                console.log('✅ Supabase initialized successfully in admin after dynamic load');
                setTimeout(window.loadAllUsersTable, 500);
              } catch (e) {
                console.log('❌ Failed to create Supabase client:', e);
              }
            }
          };
          script.onerror = function() {
            console.log('❌ Failed to load Supabase library in admin');
          };
          document.head.appendChild(script);
          return;
        }
      }
      
      let users = [];
      
      if (useSupabase && sbClient) {
        try {
          console.log('🔍 Fetching users from Supabase...');
          const { data, error } = await sbClient
            .from('users')
            .select('*');
            
          if (!error && data) {
            users = data;
            console.log('✅ Found', users.length, 'users in Supabase');
          } else {
            console.log('❌ Supabase error:', error);
          }
        } catch (e) {
          console.log('❌ Supabase exception:', e);
        }
      } else {
        console.log('⚠️ Supabase still not connected');
      }
      
      // Sort: Admins first (alphabetical), then Students (alphabetical)
      const admins = users.filter(u => u.user_type === 'admin');
      const students = users.filter(u => u.user_type === 'student');
      
      admins.sort((a, b) => {
        const nameA = (a.first_name || '').toLowerCase();
        const nameB = (b.first_name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      
      students.sort((a, b) => {
        const nameA = (a.first_name || '').toLowerCase();
        const nameB = (b.first_name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      
      const sortedUsers = [...admins, ...students];
      
      console.log('📊 Sorted: ' + admins.length + ' admins, ' + students.length + ' students');
      
      const totalCountEl = document.getElementById('totalAllUsersCount');
      const tableBody = document.getElementById('allUsersTableBody');
      
      if (totalCountEl) totalCountEl.textContent = sortedUsers.length;
      
      const totalUsersEl = document.getElementById('totalUsers');
      const totalAdminsEl = document.getElementById('totalAdmins');
      const totalStudentsEl = document.getElementById('totalStudents');
      
      if (totalUsersEl) totalUsersEl.textContent = sortedUsers.length;
      if (totalAdminsEl) totalAdminsEl.textContent = admins.length;
      if (totalStudentsEl) totalStudentsEl.textContent = students.length;
      
      if (tableBody) {
        if (sortedUsers.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">📭 No users found in database.</td></tr>';
        } else {
          let rowsHtml = '';
          let count = 0;
          
          for (let u = 0; u < sortedUsers.length; u++) {
            const user = sortedUsers[u];
            const userFirstName = user.first_name || '?';
            const userLastName = user.last_name || '?';
            const userEmail = user.email || '?';
            const userPassword = user.password || 'No password set';
            const userDob = user.dob || 'Not provided';
            const userType = user.user_type || 'student';
            const badgeClass = userType === 'admin' ? 'badge-admin' : 'badge-student';
            count++;
            
            rowsHtml += '<tr>' +
              '<td>' + count + '</td>' +
              '<td><i class="fas fa-user"></i> ' + userFirstName + ' ' + userLastName + '</td>' +
              '<td>' + userEmail + '</td>' +
              '<td><span style="font-family: monospace; font-size: 0.75rem; color: #1a6b58; background: #f0f7f5; padding: 2px 8px; border-radius: 4px;">' + userPassword + '</span></td>' +
              '<td>' + userDob + '</td>' +
              '<td><span class="' + badgeClass + '">' + userType.toUpperCase() + '</span></td>' +
              '<td>' + (userType === 'student' ? '<button class="delete-btn" onclick="window.deleteUserAccount(\'' + userEmail + '\')"><i class="fas fa-trash"></i> Delete</button>' : '—') + '</td>' +
              '</tr>';
          }
          tableBody.innerHTML = rowsHtml;
        }
      }
      
      // Search functionality
      const searchInput = document.getElementById('allUsersSearch');
      if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', function() {
          const query = this.value.toLowerCase();
          const rows = tableBody.querySelectorAll('tr');
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
          });
        });
      }
    };
    
    // ============================================
    // LOAD APPOINTMENTS TABLE
    // ============================================
    window.loadAllAppointments = async function() {
      console.log('🔄 Loading all appointments from Supabase...');
      
      if (!useSupabase || !sbClient) {
        console.log('⚠️ Supabase not ready');
        return;
      }
      
      let appointments = [];
      let users = [];
      
      try {
        // Get all appointments
        const { data: aptData, error: aptError } = await sbClient
          .from('appointments')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!aptError && aptData) {
          appointments = aptData;
          console.log('✅ Found', appointments.length, 'appointments');
        } else {
          console.log('❌ Error loading appointments:', aptError);
        }
        
        // Get all users to match emails with names
        const { data: userData, error: userError } = await sbClient
          .from('users')
          .select('*');
        
        if (!userError && userData) {
          users = userData;
        }
      } catch (e) {
        console.log('❌ Exception loading appointments:', e);
      }
      
      const totalCountEl = document.getElementById('totalAppointmentsCount');
      const tableBody = document.getElementById('appointmentsTableBody');
      
      if (totalCountEl) totalCountEl.textContent = appointments.length;
      
      if (tableBody) {
        if (appointments.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">📭 No appointments found.</td></tr>';
        } else {
          let rowsHtml = '';
          let count = 0;
          
          for (let a = 0; a < appointments.length; a++) {
            const apt = appointments[a];
            count++;
            
            // Find user by email to get full name
            const user = users.find(u => u.email === apt.user_email);
            const fullName = user ? (user.first_name || '') + ' ' + (user.last_name || '') : apt.user_email || 'Unknown';
            
            const aptDate = apt.date || 'Not provided';
            const aptTime = apt.time || 'Not provided';
            const aptType = apt.type || 'Not provided';
            const aptMessage = apt.message || 'No message';
            const aptEmail = apt.user_email || 'No email';
            
            rowsHtml += '<tr>' +
              '<td>' + count + '</td>' +
              '<td><i class="fas fa-user-graduate"></i> ' + fullName + '</td>' +
              '<td>' + aptEmail + '</td>' +
              '<td>' + aptDate + '</td>' +
              '<td>' + aptTime + '</td>' +
              '<td><span style="background: #e8f3f0; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">' + aptType + '</span></td>' +
              '<td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + aptMessage + '</td>' +
              '<td><button class="delete-btn" onclick="window.deleteAppointmentAdmin(\'' + apt.id + '\')"><i class="fas fa-trash"></i> Delete</button></td>' +
              '</tr>';
          }
          tableBody.innerHTML = rowsHtml;
        }
      }
      
      // Search functionality
      const searchInput = document.getElementById('appointmentsSearch');
      if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', function() {
          const query = this.value.toLowerCase();
          const rows = tableBody.querySelectorAll('tr');
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
          });
        });
      }
    };
    
    // ============================================
    // DELETE APPOINTMENT (Admin)
    // ============================================
    window.deleteAppointmentAdmin = async function(appointmentId) {
      if (confirm('⚠️ Are you sure you want to delete this appointment?\n\nThis action cannot be undone!')) {
        const success = await deleteAppointmentById(parseInt(appointmentId));
        if (success) {
          if (window.loadAllAppointments) {
            window.loadAllAppointments();
          }
        }
      }
    };
    
    // ============================================
    // DELETE USER ACCOUNT
    // ============================================
    window.deleteUserAccount = async function(email) {
      if (confirm('⚠️ Are you sure you want to delete student account: ' + email + '?\n\nThis action cannot be undone!')) {
        await deleteStudentAccount(email);
        showToast('✅ Student account ' + email + ' has been deleted.');
        if (window.loadAllUsersTable) {
          window.loadAllUsersTable();
        }
      }
    };
    
    // ============================================
    // REFRESH BUTTONS
    // ============================================
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    if (refreshUsersBtn) {
      refreshUsersBtn.addEventListener('click', function() {
        if (window.loadAllUsersTable) {
          window.loadAllUsersTable();
          showToast('🔄 Users refreshed!');
        }
      });
    }
    
    const refreshAppointmentsBtn = document.getElementById('refreshAppointmentsBtn');
    if (refreshAppointmentsBtn) {
      refreshAppointmentsBtn.addEventListener('click', function() {
        if (window.loadAllAppointments) {
          window.loadAllAppointments();
          showToast('🔄 Appointments refreshed!');
        }
      });
    }
    
    // ============================================
    // INITIAL LOAD
    // ============================================
    setTimeout(function() {
      console.log('🔄 Initial load of admin data...');
      if (window.loadAllUsersTable) {
        window.loadAllUsersTable();
      }
      if (window.loadAllAppointments) {
        window.loadAllAppointments();
      }
    }, 1500);
    
    // ============================================
    // AUTO-REFRESH
    // ============================================
    setInterval(function() {
      if (window.location.pathname.includes('admin.html')) {
        const activeTab = document.querySelector('.admin-tab.active');
        if (activeTab) {
          const tabId = activeTab.getAttribute('data-tab');
          if (tabId === 'users' && window.loadAllUsersTable) {
            window.loadAllUsersTable();
          } else if (tabId === 'appointments' && window.loadAllAppointments) {
            window.loadAllAppointments();
          }
        }
      }
    }, 30000);
    
    // ============================================
    // LOGOUT
    // ============================================
    const adminLogoutButton = document.getElementById('adminLogoutBtn');
    if (adminLogoutButton) {
      adminLogoutButton.addEventListener('click', function() {
        localStorage.removeItem('isAdminLoggedIn');
        window.location.href = 'index.html'; // Updated from gg.html
      });
    }
  }
})();
