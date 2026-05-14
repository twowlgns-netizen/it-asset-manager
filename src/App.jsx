import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ================================================================
// 🔑 Supabase 연결 설정
// ================================================================
const BASE_URL   = "https://djykkruijwgckiqqqlpp.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWtrcnVpandnY2tpcXFxbHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODU5MDIsImV4cCI6MjA5MzY2MTkwMn0.wASj9FFOnmYMc3xJcGVuWSK3XreWYi9x3GToyAC6cEI";
const H = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// ================================================================
// ⚙️ 상수
// ================================================================
const CLINICS = { all: "전체", gangnam: "강남의원", gangbuk: "강북의원", seoulsup: "서울숲의원" };
const ASSET_STATUS  = { active: "사용중", inactive: "미사용", repair: "수리중", storage: "보관중", dispose_target: "폐기대상", disposed: "폐기" };
const ASSET_TYPES   = { laptop: "노트북", desktop: "데스크탑", monitor: "모니터", tablet: "태블릿", phone: "스마트폰", etc: "기타" };
const SW_STATUS     = { active: "사용중", expired: "만료", inactive: "미사용", disposed: "폐기" };
const SW_CATEGORIES = { os: "운영체제", office: "오피스", security: "보안", erp: "ERP", design: "디자인", dev: "개발", etc: "기타" };
const ROLES         = { admin: "관리자", user: "일반사용자", readonly: "읽기전용" };
const STATUS_BADGE  = {
  active:         { bg: "#e8f5e9", color: "#0f6e56" },
  inactive:       { bg: "#f1f5f9", color: "#64748b" },
  repair:         { bg: "#fff7ed", color: "#c2410c" },
  storage:        { bg: "#eff6ff", color: "#2563eb" },
  disposed:       { bg: "#fff1f0", color: "#cf1322" },
  dispose_target: { bg: "#fef3c7", color: "#d97706" },
  expired:        { bg: "#fff1f0", color: "#cf1322" },
};

// 사용자 계정은 Supabase DB에서만 관리합니다.

// 하드웨어 필드
const HW_FIELDS = [
  { key: "num",           label: "번호",           type: "number"   },
  { key: "assetstatus",   label: "자산상태",        type: "select",  options: ASSET_STATUS  },
  { key: "clinic",        label: "지점",            type: "select",  options: CLINICS       },
  { key: "inspectiondate",label: "실사날짜",         type: "text"     },
  { key: "gccode",        label: "GC자산코드(SAP)",  type: "text"     },
  { key: "imedcode",      label: "아이메드코드",      type: "text"     },
  { key: "serialnumber",  label: "제조번호",          type: "text"     },
  { key: "ip",            label: "IP",              type: "text"     },
  { key: "team",          label: "팀(부서명)",        type: "text"     },
  { key: "username",      label: "사용자",            type: "text"     },
  { key: "pcname",        label: "PC 이름",           type: "text"     },
  { key: "modelname",     label: "모델명",            type: "text"     },
  { key: "assettype",     label: "자산구분",          type: "select",  options: ASSET_TYPES  },
  { key: "notes",         label: "비고(이력관리)",    type: "textarea" },
  { key: "macaddress",    label: "MAC Address",      type: "text"     },
  { key: "receiptdate",   label: "자산 수령일",       type: "text"     },
  { key: "purchasedate",  label: "구입일자",          type: "text"     },
  { key: "manufacturer",  label: "제조사",            type: "text"     },
  { key: "cpu",           label: "CPU",              type: "text"     },
  { key: "memory",        label: "Memory",           type: "text"     },
  { key: "hdd",           label: "하드디스크",        type: "text"     },
  { key: "purpose",       label: "목적/기능",         type: "text"     },
  { key: "corporation",   label: "법인",              type: "text"     },
  { key: "location",      label: "위치(건물)",        type: "text"     },
  { key: "purchaseinfo",  label: "구매정보(전자결재)", type: "text"    },
  { key: "registered_by", label: "등록자",             type: "readonly" },
  { key: "registered_at", label: "등록일시",            type: "readonly" },
];
const HW_FIELD_MAP = Object.fromEntries(HW_FIELDS.map(f => [f.key, f]));

const HW_SECTIONS = [
  { title: "📌 기본 정보",     keys: ["num","assetstatus","clinic","inspectiondate","gccode","imedcode"] },
  { title: "🌐 네트워크/장치", keys: ["ip","macaddress","pcname","modelname","assettype","serialnumber"] },
  { title: "👤 사용자/위치",   keys: ["team","username","corporation","location"] },
  { title: "⚙️ 사양",         keys: ["manufacturer","cpu","memory","hdd"] },
  { title: "🛒 구매 정보",     keys: ["receiptdate","purchasedate","purpose","purchaseinfo"] },
  { title: "📎 기타",          keys: ["notes"] },
  { title: "🧾 등록 정보",       keys: ["registered_by","registered_at"] },
];

const ALL_HW_COLS = HW_FIELDS.map(f => ({ key: f.key, label: f.label }));
const DEFAULT_HW_COLS = new Set(["num","assetstatus","clinic","gccode","team","username","modelname","assettype","location","registered_by","registered_at"]);

// ================================================================
// 🛠️ 유틸리티
// ================================================================
const nowISO = () => new Date().toISOString();
const fDT = (d) => d ? new Date(d).toLocaleString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "-";
const fDate = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "-";
const todayStr = () => new Date().toISOString().slice(0,10);

const safeJson = async (res) => {
  if (!res.ok) { const t = await res.text().catch(()=>""); throw new Error(`HTTP ${res.status}: ${t}`); }
  const t = await res.text();
  if (!t || !t.trim()) return [];
  try {
    const parsed = JSON.parse(t);
    // Supabase SELECT는 배열 반환, POST/PATCH는 배열 또는 객체 반환
    return parsed;
  } catch { return []; }
};

// 클라이언트 IP 조회 (공인 IP)
const getClientIP = async () => {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const d = await r.json();
    return d.ip || "알 수 없음";
  } catch {
    return "알 수 없음";
  }
};

// 브라우저/OS 간략 정보
const getClientInfo = () => {
  const ua = navigator.userAgent;
  let os = "기타";
  if (/Windows/.test(ua))      os = "Windows";
  else if (/Mac OS/.test(ua))  os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua))   os = "Linux";
  let browser = "기타";
  if (/Edg\//.test(ua))        browser = "Edge";
  else if (/Chrome\//.test(ua))browser = "Chrome";
  else if (/Firefox\//.test(ua))browser="Firefox";
  else if (/Safari\//.test(ua))browser = "Safari";
  return `${browser} / ${os}`;
};

const triggerDownload = (blob, name) => {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

// ================================================================
// 🧹 DB 전송 전 컬럼 정제 (DB에 없는 컬럼 제거)
// ================================================================
// assets 테이블의 실제 DB 컬럼 목록 (hwnum, name, type 등 없는 컬럼 제외)
const HW_DB_COLS = new Set([
  "id","num","assetstatus","clinic","inspectiondate","gccode","imedcode",
  "serialnumber","ip","team","username","pcname","modelname","assettype",
  "notes","macaddress","receiptdate","purchasedate","manufacturer","cpu",
  "memory","hdd","purpose","corporation","location","purchaseinfo","created_at",
  "registered_by","registered_at"
]);
// software 테이블의 실제 DB 컬럼 목록
const SW_DB_COLS = new Set([
  "id","name","category","version","vendor","licensetype","licensekey",
  "quantity","cost","purchasedate","expirydate","assignedto","clinic","status",
  "notes","created_at","registered_by","registered_at"
]);

const sanitizeHW = (obj) => {
  const out = {};
  Object.keys(obj).forEach(k => { if (HW_DB_COLS.has(k)) out[k] = obj[k]; });
  return out;
};
const sanitizeSW = (obj) => {
  const out = {};
  Object.keys(obj).forEach(k => { if (SW_DB_COLS.has(k)) out[k] = obj[k]; });
  return out;
};

// ================================================================
// 🌐 API
// ================================================================

// Supabase에서 전체 데이터를 페이지 단위로 모두 가져오는 헬퍼
// PostgREST는 기본 1000건 제한 → Range 헤더로 페이지 단위 반복 조회
const fetchAllPages = async (url) => {
  const PAGE = 1000;
  let from = 0, all = [];
  while (true) {
    const res = await fetch(`${url}&limit=${PAGE}&offset=${from}`, {
      headers: { ...H, "Prefer": "count=exact", "Range-Unit": "items", "Range": `${from}-${from + PAGE - 1}` }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    const rows = text && text.trim() ? JSON.parse(text) : [];
    all = all.concat(rows);
    // Content-Range: from-to/total
    const cr = res.headers.get("Content-Range");
    const total = cr ? parseInt(cr.split("/")[1]) : 0;
    from += PAGE;
    if (all.length >= total || rows.length < PAGE) break;
  }
  return all;
};

// DB에서 직접 count를 가져오는 헬퍼 (대시보드 통계용)
const fetchCount = async (table, query = "") => {
  const res = await fetch(`${BASE_URL}/${table}?select=id${query}`, {
    headers: { ...H, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0" }
  });
  const cr = res.headers.get("Content-Range");
  const n = cr ? parseInt(cr.split("/")[1]) : 0;
  return isNaN(n) ? 0 : n;
};

const api = {
  // 자산 — fetchAllPages로 1000건 초과도 전체 조회
  getHW: () => fetchAllPages(`${BASE_URL}/assets?select=*&order=num.asc.nullslast,created_at.desc`),
  addHW:    (d) => fetch(`${BASE_URL}/assets`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(sanitizeHW(d)) }).then(safeJson),
  updateHW: (id,d) => fetch(`${BASE_URL}/assets?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(sanitizeHW(d)) }).then(safeJson),
  deleteHW: (id) => fetch(`${BASE_URL}/assets?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
  // 소프트웨어
  getSW: () => fetchAllPages(`${BASE_URL}/software?select=*&order=created_at.desc`),
  addSW:    (d) => fetch(`${BASE_URL}/software`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(sanitizeSW(d)) }).then(safeJson),
  updateSW: (id,d) => fetch(`${BASE_URL}/software?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(sanitizeSW(d)) }).then(safeJson),
  deleteSW: (id) => fetch(`${BASE_URL}/software?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
  // 사용자
  getUsers:    () => fetch(`${BASE_URL}/users?select=*`, { headers:H }).then(safeJson),
  addUser:     (d) => fetch(`${BASE_URL}/users`, { method:"POST", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  updateUser:  (id,d) => fetch(`${BASE_URL}/users?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=representation"}, body:JSON.stringify(d) }).then(safeJson),
  deleteUser:  (id) => fetch(`${BASE_URL}/users?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),
  // 히스토리
  getHistory: () => fetch(`${BASE_URL}/history?select=*&order=ts.desc&limit=1000`, { headers:H }).then(safeJson),
  getHistoryCount: async () => {
    const res = await fetch(`${BASE_URL}/history?select=id`, { headers:{...H,"Prefer":"count=exact","Range-Unit":"items","Range":"0-0"} });
    const ct = res.headers.get("Content-Range");
    const total = ct ? parseInt(ct.split("/")[1]) : 0;
    return isNaN(total) ? 0 : total;
  },
  addHistory: (d) => fetch(`${BASE_URL}/history`, { method:"POST", headers:H, body:JSON.stringify(d) }).then(safeJson),
  // 휴지통
  getTrash: () => fetchAllPages(`${BASE_URL}/trash?select=*&order=deletedat.desc.nullslast`),
  addTrash: async (d) => {
    const itemObj = typeof d.item_data === "string"
      ? (() => { try { return JSON.parse(d.item_data); } catch { return d.item_data; } })()
      : d.item_data;
    const body = { ...d, item_data: itemObj };
    const res = await fetch(`${BASE_URL}/trash`, {
      method: "POST",
      headers: { ...H, "Prefer": "return=representation" },
      body: JSON.stringify(body)
    });
    return safeJson(res);
  },
  deleteTrash: (id) => fetch(`${BASE_URL}/trash?id=eq.${id}`, { method:"DELETE", headers:H }).then(safeJson),

  // ── 대시보드 전용: DB에서 직접 count 조회 (프론트 배열 의존 제거)
  getDashboardStats: async () => {
    const [
      hwTotal, hwActive, hwInactive, hwRepair, hwStorage, hwDisposed, hwDisposeTarget,
      swTotal,
      trashTotal, trashHW, trashSW,
      gangnam, gangbuk, seoulsup,
    ] = await Promise.all([
      fetchCount("assets"),
      fetchCount("assets", "&assetstatus=eq.active"),
      fetchCount("assets", "&assetstatus=eq.inactive"),
      fetchCount("assets", "&assetstatus=eq.repair"),
      fetchCount("assets", "&assetstatus=eq.storage"),
      fetchCount("assets", "&assetstatus=eq.disposed"),
      fetchCount("assets", "&assetstatus=eq.dispose_target"),
      fetchCount("software"),
      fetchCount("trash"),
      fetchCount("trash", "&table_name=eq.assets"),
      fetchCount("trash", "&table_name=eq.software"),
      fetchCount("assets", "&clinic=eq.gangnam"),
      fetchCount("assets", "&clinic=eq.gangbuk"),
      fetchCount("assets", "&clinic=eq.seoulsup"),
    ]);
    // 미분류: 알려진 상태값에 해당하지 않는 건수
    const hwKnown = hwActive + hwInactive + hwRepair + hwStorage + hwDisposed + hwDisposeTarget;
    const hwUnclassified = Math.max(0, hwTotal - hwKnown);
    // 미분류 지점: gangnam/gangbuk/seoulsup 외 나머지
    const clinicKnown = gangnam + gangbuk + seoulsup;
    const clinicUnclassified = Math.max(0, hwTotal - clinicKnown);
    return {
      hw: { total:hwTotal, active:hwActive, inactive:hwInactive, repair:hwRepair, storage:hwStorage, disposed:hwDisposed, dispose_target:hwDisposeTarget, unclassified:hwUnclassified },
      sw: { total:swTotal },
      trash: { total:trashTotal, hw:trashHW, sw:trashSW },
      clinics: { gangnam, gangbuk, seoulsup, unclassified:clinicUnclassified },
    };
  },
};

// ================================================================
// 🏠 [메인 앱]
// ================================================================
export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      html { height: 100%; margin: 0; padding: 0; }
      body { height: 100%; margin: 0; padding: 0; overflow: hidden; box-sizing: border-box; }
      #root { height: 100%; overflow: hidden; }
      .hw-no-sb::-webkit-scrollbar { display: none; }
      /* 메인 우측 세로 스크롤바 - 테이블 하단 스크롤바와 동일 스타일 */
      .main-content-area::-webkit-scrollbar { width: 12px; }
      .main-content-area::-webkit-scrollbar-track { background: #f1f5f9; border-left: 1px solid #e2e8f0; }
      .main-content-area::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; border: 2px solid #f1f5f9; }
      .main-content-area::-webkit-scrollbar-thumb:hover { background: #64748b; }
      .main-content-area { scrollbar-width: thin; scrollbar-color: #94a3b8 #f1f5f9; }
      /* 기타 스크롤바 최소화 */
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const [isLoggedIn,  setIsLoggedIn]  = useState(() => localStorage.getItem("isLoggedIn") === "true");
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem("currentUser"); return s ? JSON.parse(s) : null; });
  const [view,    setView]    = useState("dashboard");
  const [hwClinicFilter, setHwClinicFilter] = useState("all");
  const [swClinicFilter, setSwClinicFilter] = useState("all");
  const [isMobile,setIsMobile]= useState(typeof window!=="undefined" ? window.innerWidth<768 : false);
  const [hw,      setHw]      = useState([]);
  const [sw,      setSw]      = useState([]);
  const [users,   setUsers]   = useState([]);
  const [history, setHistory] = useState([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [trash,   setTrash]   = useState([]);
  const [dashStats, setDashStats] = useState(null); // DB 직접 집계값

  const handleLogin  = async (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    localStorage.setItem("isLoggedIn","true");
    localStorage.setItem("currentUser",JSON.stringify(user));
    // 로그인 로그 기록
    const ip = await getClientIP();
    const clientInfo = getClientInfo();
    const detail = `계정: ${user.name} (${user.loginid||""}) / 권한: ${ROLES[user.role]||user.role} / 지점: ${CLINICS[user.clinic]||user.clinic||"전체"} / IP: ${ip} / 환경: ${clientInfo}`;
    api.addHistory({
      ts: nowISO(), action:"로그인", atype:"user", aid: user.id||"", aname: user.name,
      detail, before:"", after:"",
      username: user.name, userrole: user.role, clinic: user.clinic||""
    }).catch(console.error);
    // 로그인 직후 모든 데이터 즉시 재조회 (휴지통 포함)
    // useEffect의 fetchAll은 isLoggedIn state 변경 후 비동기로 실행되므로
    // 여기서도 명시적으로 호출하여 즉각 반영
    Promise.all([
      api.getHW(),
      api.getSW(),
      api.getUsers(),
      api.getHistory(),
      api.getHistoryCount(),
      api.getTrash(),
      api.getDashboardStats(),
    ]).then(([hw, sw, users, hist, histCount, trash, stats]) => {
      setHw(Array.isArray(hw) ? hw : []);
      setSw(Array.isArray(sw) ? sw : []);
      setUsers(Array.isArray(users) ? users : []);
      const l = Array.isArray(hist) ? hist : [];
      setHistory(l.sort((a,b) => new Date(b.ts) - new Date(a.ts)));
      setHistoryCount(histCount || 0);
      setTrash(Array.isArray(trash) ? trash : []);
      setDashStats(stats);
    }).catch(console.error);
  };

  const handleLogout = async () => {
    // 로그아웃 로그: currentUser가 있는 동안 먼저 기록
    if (currentUser) {
      const ip = await getClientIP();
      const clientInfo = getClientInfo();
      const detail = `계정: ${currentUser.name} (${currentUser.loginid||""}) / 권한: ${ROLES[currentUser.role]||currentUser.role} / 지점: ${CLINICS[currentUser.clinic]||currentUser.clinic||"전체"} / IP: ${ip} / 환경: ${clientInfo}`;
      await api.addHistory({
        ts: nowISO(), action:"로그아웃", atype:"user", aid: currentUser.id||"", aname: currentUser.name,
        detail, before:"", after:"",
        username: currentUser.name, userrole: currentUser.role, clinic: currentUser.clinic||""
      }).catch(console.error);
    }
    // 로그아웃 시 모든 데이터 state 초기화 (다음 로그인 시 깨끗하게 재조회)
    setHw([]); setSw([]); setUsers([]); setHistory([]); setHistoryCount(0); setTrash([]);
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
  };

  // ── 전체 데이터 재조회 함수 (useCallback 의존성 없이 순수 함수로)
  const fetchAll = useCallback(() => {
    api.getHW().then(d=>setHw(Array.isArray(d)?d:[])).catch(console.error);
    api.getSW().then(d=>setSw(Array.isArray(d)?d:[])).catch(console.error);
    api.getUsers().then(d=>setUsers(Array.isArray(d)?d:[])).catch(console.error);
    api.getHistory().then(d=>{ const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }).catch(console.error);
    api.getHistoryCount().then(n=>setHistoryCount(n)).catch(console.error);
    api.getTrash().then(d=>setTrash(Array.isArray(d)?d:[])).catch(console.error);
    api.getDashboardStats().then(s=>setDashStats(s)).catch(console.error);
  }, []); // setter 함수는 참조가 변하지 않으므로 의존성 불필요

  // ── resize 리스너: 마운트/언마운트 시 1번만 등록 (fetchAll과 분리)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── 로그인 상태 변경 시 전체 데이터 재조회
  // localStorage에서 isLoggedIn=true로 복원된 경우(앱 업데이트/새로고침)에도 실행
  useEffect(() => {
    if (isLoggedIn) {
      fetchAll();
    }
  }, [isLoggedIn, fetchAll]);

  const addHistory = useCallback((action, aType, aId, aName, detail, before="", after="", silent=false) => {
    if (!currentUser) return Promise.resolve();
    return api.addHistory({ ts: nowISO(), action, atype: aType, aid: aId, aname: aName, detail, before, after, username: currentUser.name, userrole: currentUser.role, clinic: currentUser.clinic || "" })
      .then(() => {
        if (silent) return; // 배치 처리 중에는 재조회 생략
        return Promise.all([
          api.getHistory().then(d => { const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }),
          api.getHistoryCount().then(n=>setHistoryCount(n)),
          api.getDashboardStats().then(s=>setDashStats(s)),
        ]);
      })
      .catch(console.error);
  }, [currentUser]);

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "user";
  const isAdmin = currentUser?.role === "admin";

  const menuItems = [
    { id: "dashboard", label: "홈",       icon: "🏠" },
    { id: "hardware",  label: "장비 (전체)", icon: "🖥️" },
    { id: "hw_gangnam",   label: "　강남의원",   icon: "🏥", clinicKey:"gangnam",  menuType:"hw" },
    { id: "hw_gangbuk",   label: "　강북의원",   icon: "🏥", clinicKey:"gangbuk",  menuType:"hw" },
    { id: "hw_seoulsup",  label: "　서울숲의원", icon: "🏥", clinicKey:"seoulsup", menuType:"hw" },
    { id: "software",  label: "소프트웨어 (전체)", icon: "💿" },
    { id: "sw_gangnam",   label: "　강남의원",   icon: "🏥", clinicKey:"gangnam",  menuType:"sw" },
    { id: "sw_gangbuk",   label: "　강북의원",   icon: "🏥", clinicKey:"gangbuk",  menuType:"sw" },
    { id: "sw_seoulsup",  label: "　서울숲의원", icon: "🏥", clinicKey:"seoulsup", menuType:"sw" },
    { id: "users",     label: "사용자",   icon: "👤" },
    { id: "qrscan",    label: "QR 스캔",  icon: "📷" },
    { id: "history",   label: "로그",     icon: "📝" },
    { id: "trash",     label: "휴지통",   icon: "🗑️" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:isMobile?"column":"row", height:"100vh", background:"#f8fafc", overflow:"hidden" }}>
      {!isMobile && (
        <div style={{ width:220, background:"#fff", borderRight:"1px solid #e2e8f0", padding:"24px 16px", display:"flex", flexDirection:"column" }}>
          <div onClick={()=>{ setView("dashboard"); window.location.reload(); }} style={{ fontSize:16, fontWeight:800, color:"#0f6e56", marginBottom:28, cursor:"pointer", userSelect:"none" }}>IT Asset Manager</div>
          <div style={{ flex:1 }}>
            {menuItems.map(m => (
              <div key={m.id} onClick={()=>{
                  if(m.menuType==="hw"){
                    setView("hardware"); setHwClinicFilter(m.clinicKey);
                  } else if(m.menuType==="sw"){
                    setView("software"); setSwClinicFilter(m.clinicKey);
                  } else {
                    setView(m.id);
                    if(m.id==="hardware") setHwClinicFilter("all");
                    if(m.id==="software") setSwClinicFilter("all");
                  }
                }}
                style={{ padding:"10px 14px", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", gap:8,
                  background: m.menuType==="hw"
                    ? (view==="hardware" && hwClinicFilter===m.clinicKey ? "#e8f5e9" : "transparent")
                    : m.menuType==="sw"
                    ? (view==="software" && swClinicFilter===m.clinicKey ? "#e8f5e9" : "transparent")
                    : (view===m.id ? "#e8f5e9" : "transparent"),
                  color: m.menuType==="hw"
                    ? (view==="hardware" && hwClinicFilter===m.clinicKey ? "#0f6e56" : "#94a3b8")
                    : m.menuType==="sw"
                    ? (view==="software" && swClinicFilter===m.clinicKey ? "#0f6e56" : "#94a3b8")
                    : (view===m.id ? "#0f6e56" : "#64748b"),
                  fontWeight: (m.menuType==="hw"||m.menuType==="sw") ? 500 : 700,
                  marginBottom:3, fontSize: (m.menuType==="hw"||m.menuType==="sw") ? 12 : 13 }}>
                <span>{m.icon}</span>{m.label}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:6 }}>{currentUser?.name} ({CLINICS[currentUser?.clinic]||currentUser?.clinic||"전체"})</div>
          <Btn onClick={handleLogout} style={{ fontSize:12 }}>로그아웃</Btn>
        </div>
      )}

      <div className="main-content-area" style={{ flex:1, overflowY:"auto", overflowX:"hidden", minWidth:0, WebkitOverflowScrolling:"touch" }}>
        {isMobile && (
          <div style={{ background:"#fff", padding:"14px 18px", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
            <span onClick={()=>{ setView("dashboard"); window.location.reload(); }} style={{ fontWeight:800, color:"#0f6e56", fontSize:16, cursor:"pointer", userSelect:"none" }}>IT Asset Manager</span>
            <Btn onClick={handleLogout} style={{ fontSize:11, padding:"5px 10px" }}>로그아웃</Btn>
          </div>
        )}
        <main style={{ padding:isMobile?"16px":"32px", paddingBottom:isMobile?130:60, boxSizing:"border-box", width:"100%" }}>
          {/* 
            성능 최적화: 조건부 렌더링({view==="x" && ...}) 대신 display:none으로 숨김.
            메뉴 전환 시 이미 마운트된 컴포넌트는 state를 유지한 채 즉시 표시.
            단, QR스캔·휴지통처럼 진입 시 매번 재조회가 필요한 섹션은 조건부 렌더링 유지.
          */}
          <div style={{display:view==="dashboard" ?"block":"none"}}><DashboardSection  hw={hw} sw={sw} history={history} historyCount={historyCount} trash={trash} isMobile={isMobile} dashStats={dashStats} /></div>
          <div style={{display:view==="hardware"  ?"block":"none"}}><HardwareSection   data={hw} setHw={setHw} addHistory={addHistory} canEdit={canEdit} trash={trash} setTrash={setTrash} currentUser={currentUser} setView={setView} initClinic={hwClinicFilter} setHistory={setHistory} setHistoryCount={setHistoryCount} setDashStats={setDashStats} /></div>
          <div style={{display:view==="software"  ?"block":"none"}}><SoftwareSection   data={sw} setSw={setSw} addHistory={addHistory} canEdit={canEdit} trash={trash} setTrash={setTrash} currentUser={currentUser} initClinic={swClinicFilter} setHistory={setHistory} setHistoryCount={setHistoryCount} setDashStats={setDashStats} /></div>
          <div style={{display:view==="users"     ?"block":"none"}}><UsersSection      users={users} setUsers={setUsers} addHistory={addHistory} isAdmin={isAdmin} currentUser={currentUser} /></div>
          <div style={{display:view==="history"   ?"block":"none"}}><HistorySection    history={history} historyCount={historyCount} currentUser={currentUser} /></div>
          {view==="qrscan" && <QRScanSection hw={hw} currentUser={currentUser} />}
          {view==="trash"  && <TrashSection  trash={trash} setTrash={setTrash} setHw={setHw} setSw={setSw} addHistory={addHistory} canEdit={canEdit} currentUser={currentUser} />}
        </main>
      </div>

      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, height:65, background:"#fff", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"space-around", alignItems:"center", zIndex:1000 }}>
          {/* 모바일 탭바: 지점 서브메뉴(menuType) 제외하고 주요 메뉴만 표시 */}
          {menuItems.filter(m => !m.menuType).map(m => (
            <div key={m.id} onClick={()=>{
                setView(m.id);
                if(m.id==="hardware") setHwClinicFilter("all");
                if(m.id==="software") setSwClinicFilter("all");
              }} style={{ textAlign:"center", color:view===m.id?"#0f6e56":"#94a3b8", cursor:"pointer", padding:"4px 2px", minWidth:0 }}>
              <div style={{ fontSize:18 }}>{m.icon}</div>
              <div style={{ fontSize:9, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:48 }}>
                {m.id==="hardware" ? "장비" : m.id==="software" ? "소프트웨어" : m.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// 📊 [대시보드]
// ================================================================
function DashboardSection({ hw, sw, history, historyCount, trash, isMobile, dashStats, onHwClinic }) {
  const [clinicFilter, setClinicFilter] = useState("all");

  // ── 통계값: dashStats(DB 직접 집계) 우선, 없으면 배열 계산(폴백)
  const hwStats = dashStats ? dashStats.hw : {
    total:          hw.length,
    active:         hw.filter(h=>h.assetstatus==="active").length,
    inactive:       hw.filter(h=>h.assetstatus==="inactive").length,
    repair:         hw.filter(h=>h.assetstatus==="repair").length,
    storage:        hw.filter(h=>h.assetstatus==="storage").length,
    disposed:       hw.filter(h=>h.assetstatus==="disposed").length,
    dispose_target: hw.filter(h=>h.assetstatus==="dispose_target").length,
    unclassified:   0,
  };
  const swTotal    = dashStats ? dashStats.sw.total    : sw.length;
  const trashCount = dashStats ? dashStats.trash.total : (Array.isArray(trash) ? trash.length : 0);
  const trashHW    = dashStats ? dashStats.trash.hw    : (Array.isArray(trash) ? trash.filter(t=>(t.table_name||"assets")==="assets").length : 0);
  const trashSW    = dashStats ? dashStats.trash.sw    : (Array.isArray(trash) ? trash.filter(t=>t.table_name==="software").length : 0);

  // 지점별 카운트 (미분류 포함)
  const clinicCounts = [
    { key:"gangnam",  name:"강남의원",   count: dashStats ? (dashStats.clinics.gangnam??0)  : hw.filter(h=>h.clinic==="gangnam").length,  color:"#0f6e56", icon:"🏥" },
    { key:"gangbuk",  name:"강북의원",   count: dashStats ? (dashStats.clinics.gangbuk??0)  : hw.filter(h=>h.clinic==="gangbuk").length,  color:"#2563eb", icon:"🏥" },
    { key:"seoulsup", name:"서울숲의원", count: dashStats ? (dashStats.clinics.seoulsup??0) : hw.filter(h=>h.clinic==="seoulsup").length, color:"#7c3aed", icon:"🏥" },
    { key:"__unclassified__", name:"미분류/기타", count: dashStats ? (dashStats.clinics.unclassified??0) : hw.filter(h=>!["gangnam","gangbuk","seoulsup"].includes(h.clinic)).length, color:"#94a3b8", icon:"❓" },
  ];

  // clinicFilter 선택 시 배열 기반 재계산
  const filtered = clinicFilter === "all" ? hw : (clinicFilter === "__unclassified__" ? hw.filter(h=>!["gangnam","gangbuk","seoulsup"].includes(h.clinic)) : hw.filter(h=>h.clinic===clinicFilter));
  const fStats = clinicFilter === "all" ? hwStats : {
    total:          filtered.length,
    active:         filtered.filter(h=>h.assetstatus==="active").length,
    inactive:       filtered.filter(h=>h.assetstatus==="inactive").length,
    repair:         filtered.filter(h=>h.assetstatus==="repair").length,
    storage:        filtered.filter(h=>h.assetstatus==="storage").length,
    disposed:       filtered.filter(h=>h.assetstatus==="disposed").length,
    dispose_target: filtered.filter(h=>h.assetstatus==="dispose_target").length,
    unclassified:   filtered.filter(h=>!Object.keys(ASSET_STATUS).includes(h.assetstatus)).length,
  };

  const isLoading = !dashStats && hw.length === 0;

  // 상태별 카드 정의
  const hwStatusCards = [
    { label:"전체 장비",  key:"total",          value:fStats.total,          color:"#0f6e56", bg:"#e8f5e9", icon:"🖥️" },
    { label:"사용중",     key:"active",          value:fStats.active,         color:"#2563eb", bg:"#eff6ff", icon:"✅" },
    { label:"미사용",     key:"inactive",        value:fStats.inactive,       color:"#64748b", bg:"#f1f5f9", icon:"⏸️" },
    { label:"수리중",     key:"repair",          value:fStats.repair,         color:"#c2410c", bg:"#fff7ed", icon:"🔧" },
    { label:"보관중",     key:"storage",         value:fStats.storage,        color:"#0891b2", bg:"#ecfeff", icon:"📦" },
    { label:"폐기대상",   key:"dispose_target",  value:fStats.dispose_target, color:"#d97706", bg:"#fef3c7", icon:"⚠️" },
    { label:"폐기",       key:"disposed",        value:fStats.disposed,       color:"#cf1322", bg:"#fff1f0", icon:"🗑️" },
    { label:"미분류",     key:"unclassified",    value:fStats.unclassified ?? (clinicFilter==="all" ? (hwStats.unclassified??0) : filtered.filter(h=>!Object.keys(ASSET_STATUS).includes(h.assetstatus)).length), color:"#94a3b8", bg:"#f8fafc", icon:"❓" },
  ];

  return (
    <div style={{display:"flex", flexDirection:"column", gap:20}}>

      {/* ── 헤더 */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <h2 style={{fontSize:20, fontWeight:800, margin:0, color:"#0f172a"}}>실시간 현황</h2>
          <span style={{fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700,
            background: dashStats ? "#e8f5e9" : "#fef3c7",
            color:      dashStats ? "#0f6e56" : "#d97706"}}>
            {isLoading ? "⏳ 로딩 중..." : dashStats ? "✅ DB 정확값" : "📋 로컬 데이터"}
          </span>
        </div>
        <select value={clinicFilter} onChange={e=>setClinicFilter(e.target.value)}
          style={{padding:"8px 14px", borderRadius:10, border:"1px solid #e2e8f0", fontSize:13, background:"#fff", color:"#334155", fontWeight:600, cursor:"pointer"}}>
          <option value="all">전체 지점</option>
          {clinicCounts.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
      </div>

      {/* ── 섹션1: 지점별 장비 현황 */}
      <div>
        <div style={{fontSize:12, fontWeight:700, color:"#64748b", marginBottom:10, display:"flex", alignItems:"center", gap:6}}>
          <span style={{width:3, height:14, background:"#0f6e56", borderRadius:2, display:"inline-block"}}/>
          지점별 장비 현황
        </div>
        <div style={{display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10}}>
          {clinicCounts.map(c => (
            <div key={c.key}
              onClick={()=>setClinicFilter(clinicFilter===c.key?"all":c.key)}
              style={{
                background: clinicFilter===c.key ? c.color : "#fff",
                padding:"16px 18px", borderRadius:14,
                border:`1.5px solid ${clinicFilter===c.key ? c.color : "#e2e8f0"}`,
                cursor:"pointer", transition:"all 0.15s",
                boxShadow: clinicFilter===c.key ? `0 4px 16px ${c.color}30` : "none",
              }}>
              <div style={{fontSize:11, color: clinicFilter===c.key?"rgba(255,255,255,0.8)":"#94a3b8", marginBottom:6, fontWeight:600}}>
                {c.icon} {c.name}
              </div>
              <div style={{fontSize:30, fontWeight:900, color: clinicFilter===c.key?"#fff":c.color, lineHeight:1}}>
                {isLoading ? "-" : c.count.toLocaleString()}
              </div>
              <div style={{fontSize:11, color: clinicFilter===c.key?"rgba(255,255,255,0.7)":"#94a3b8", marginTop:4}}>
                {c.key==="__unclassified__" ? "미분류 장비" : "등록 장비"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 섹션2: 장비 상태별 현황 */}
      <div>
        <div style={{fontSize:12, fontWeight:700, color:"#64748b", marginBottom:10, display:"flex", alignItems:"center", gap:6}}>
          <span style={{width:3, height:14, background:"#2563eb", borderRadius:2, display:"inline-block"}}/>
          장비 상태별 현황
          {clinicFilter !== "all" && (
            <span style={{fontSize:11, color:"#0f6e56", background:"#e8f5e9", padding:"2px 8px", borderRadius:10, fontWeight:600}}>
              {clinicCounts.find(c=>c.key===clinicFilter)?.name || clinicFilter} 필터 적용
            </span>
          )}
        </div>
        <div style={{display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":`repeat(4,1fr)`, gap:10}}>
          {hwStatusCards.map(c => (
            <div key={c.key} style={{background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"14px 16px",
              display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
              boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div>
                <div style={{fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:26, fontWeight:900, color: isLoading?"#e2e8f0":c.color, lineHeight:1}}>
                  {isLoading ? "-" : c.value.toLocaleString()}
                </div>
              </div>
              <div style={{width:36, height:36, borderRadius:10, background:c.bg,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0}}>
                {c.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 섹션3: 기타 현황 (소프트웨어 / 로그 / 휴지통) */}
      <div>
        <div style={{fontSize:12, fontWeight:700, color:"#64748b", marginBottom:10, display:"flex", alignItems:"center", gap:6}}>
          <span style={{width:3, height:14, background:"#7c3aed", borderRadius:2, display:"inline-block"}}/>
          기타 현황
        </div>
        <div style={{display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:10}}>
          {[
            { label:"소프트웨어", value:swTotal, color:"#7c3aed", bg:"#f5f3ff", icon:"💿", sub:null },
            { label:"활동 로그",  value:historyCount>0?historyCount:history.length, color:"#0891b2", bg:"#ecfeff", icon:"📝", sub:null },
            { label:"휴지통",     value:trashCount, color:"#94a3b8", bg:"#f8fafc", icon:"🗑️", sub:`장비 ${trashHW}건 · SW ${trashSW}건` },
          ].map(c=>(
            <div key={c.label} style={{background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"14px 16px",
              display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
              boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div>
                <div style={{fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:26, fontWeight:900, color:c.color, lineHeight:1}}>
                  {c.value.toLocaleString()}
                </div>
                {c.sub && <div style={{fontSize:11, color:"#94a3b8", marginTop:4}}>{c.sub}</div>}
              </div>
              <div style={{width:36, height:36, borderRadius:10, background:c.bg,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0}}>
                {c.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 섹션4: 최근 활동 로그 */}
      <div>
        <div style={{fontSize:12, fontWeight:700, color:"#64748b", marginBottom:10, display:"flex", alignItems:"center", gap:6}}>
          <span style={{width:3, height:14, background:"#0891b2", borderRadius:2, display:"inline-block"}}/>
          최근 활동 로그
        </div>
        <div style={{background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          {history.slice(0,10).length === 0
            ? <div style={{padding:"32px 0", textAlign:"center", color:"#94a3b8", fontSize:13}}>활동 기록이 없습니다.</div>
            : history.slice(0,10).map((h,i) => (
              <div key={i} style={{
                padding:"10px 16px",
                borderBottom: i < Math.min(history.length,10)-1 ? "1px solid #f1f5f9" : "none",
                display:"flex", gap:10, alignItems:"center", flexWrap:"wrap",
                background: i%2===0 ? "#fff" : "#fafafa"
              }}>
                <span style={{fontSize:11, color:"#94a3b8", flexShrink:0, minWidth:90}}>{fDT(h.ts)}</span>
                <span style={{fontSize:12, fontWeight:700, color:"#0f6e56", flexShrink:0}}>{h.username}</span>
                <span style={{fontSize:11, background:"#f1f5f9", color:"#475569", padding:"2px 8px", borderRadius:8, flexShrink:0}}>{h.action}</span>
                <span style={{fontSize:12, color:"#334155", fontWeight:600, flexShrink:0}}>{h.aname}</span>
                {h.detail && <span style={{fontSize:11, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:300}}>{h.detail}</span>}
              </div>
            ))
          }
        </div>
      </div>

    </div>
  );
}

// ================================================================
// 🖥️ [하드웨어]
// ================================================================
function HardwareSection({ data, setHw, addHistory, canEdit, trash, setTrash, currentUser, setView, initClinic, setHistory, setHistoryCount, setDashStats }) {
  const [modal,        setModal]        = useState(null);
  const [form,         setForm]         = useState({});
  const [detailItem,   setDetailItem]   = useState(null);
  const [qrItem,       setQrItem]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [importLoading,setImportLoading]= useState(false);
  const [fixLoading,   setFixLoading]   = useState(false);
  const [searchText,   setSearchText]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [filterClinic, setFilterClinic] = useState(initClinic||"all");
  const [showColMenu,  setShowColMenu]  = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const hwColPrefKey = `hw_cols_${currentUser?.loginid||"default"}`;
  const hwPageSizeKey = `hw_pagesize_${currentUser?.loginid||"default"}`;
  const [pageSize,     setPageSize]     = useState(()=>{ try{const s=localStorage.getItem(hwPageSizeKey);return s?Number(s):20;}catch{return 20;} });
  const [currentPage,  setCurrentPage]  = useState(1);
  const [visibleCols,  setVisibleCols]  = useState(()=>loadColPref(hwColPrefKey, DEFAULT_HW_COLS));
  const fileInputRef = useRef(null);
  const colMenuRef   = useRef(null);

  useEffect(() => {
    const h = (e) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  // 사이드바 지점 메뉴 클릭 시 필터 동기화
  useEffect(() => { setFilterClinic(initClinic||"all"); setCurrentPage(1); }, [initClinic]);

  const toggleCol = (key) => setVisibleCols(prev => {
    const n=new Set(prev); n.has(key)?n.delete(key):n.add(key);
    saveColPref(hwColPrefKey, n); return n;
  });
  const toggleAll = (all) => {
    const n=all?new Set(ALL_HW_COLS.map(c=>c.key)):new Set(["gccode"]);
    saveColPref(hwColPrefKey, n); setVisibleCols(n);
  };

  const filtered = useMemo(() => data.filter(h => {
    const q = searchText.trim().toLowerCase();
    const matchText = !q || [h.gccode,h.imedcode,h.username,h.team,h.modelname,h.location,h.pcname,h.serialnumber,h.notes]
      .some(v=>(v||"").toLowerCase().includes(q));
    const matchStatus = !filterStatus || h.assetstatus===filterStatus;
    const matchType   = !filterType   || h.assettype===filterType;
    const matchClinic = filterClinic==="all" || h.clinic===filterClinic;
    return matchText && matchStatus && matchType && matchClinic;
  }), [data, searchText, filterStatus, filterType, filterClinic]);

  // 페이지네이션
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const pagedRows  = useMemo(() =>
    pageSize === 0 ? filtered : filtered.slice((currentPage-1)*pageSize, currentPage*pageSize),
    [filtered, pageSize, currentPage]);

  // 필터 바뀌면 1페이지로
  useEffect(() => setCurrentPage(1), [searchText, filterStatus, filterType, filterClinic, pageSize]);



  const deleteSelected = async () => {
    if (selectedIds.size === 0) return alert("삭제할 항목을 선택하세요.");
    if (!window.confirm(`선택한 ${selectedIds.size}건을 휴지통으로 이동하시겠습니까?`)) return;

    const items = data.filter(h => selectedIds.has(h.id));
    const BATCH = 10; // 동시 처리 최대 건수
    let ok = 0, fail = 0;
    const savedTrash = [];

    // ── UI에서 즉시 제거 (낙관적 업데이트)
    const deletingIds = new Set(items.map(i=>i.id));
    setHw(prev => prev.filter(h => !deletingIds.has(h.id)));
    setSelectedIds(new Set());

    // ── BATCH 단위로 병렬 처리
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(async (item) => {
          const name = item.gccode||item.modelname||"자산";
          // ① 휴지통 저장
          const trashResult = await api.addTrash({ item_data: item, table_name:"assets", deletedat:nowISO() });
          const saved = Array.isArray(trashResult) ? trashResult[0] : trashResult;
          if (!saved?.id) throw new Error("휴지통 저장 실패");
          // ② 원본 삭제
          await api.deleteHW(item.id);
          // ③ 로그 기록 (silent=true: 재조회 생략)
          addHistory("하드웨어 삭제","hardware",item.id,name,
            `선택삭제-휴지통 / 지점:${item.clinic||"-"} / 팀:${item.team||"-"} / 사용자:${item.username||"-"}`,
            JSON.stringify(item),"", true);
          return saved;
        })
      );
      results.forEach(r => {
        if (r.status === "fulfilled") { savedTrash.push(r.value); ok++; }
        else { fail++; console.error("선택삭제 오류:", r.reason); }
      });
    }

    // ── 완료 후 일괄 UI 반영 + 재조회
    if (savedTrash.length > 0) setTrash(prev => [...prev, ...savedTrash]);
    const [fresh, newTrash, , newCount, newStats] = await Promise.all([
      api.getHW(), api.getTrash(), null,
      api.getHistoryCount(),
      api.getDashboardStats(),
    ]);
    setHw(Array.isArray(fresh)?fresh:[]);
    setTrash(Array.isArray(newTrash)?newTrash:[]);
    setHistoryCount(newCount||0);
    setDashStats(newStats);
    // 로그 목록도 갱신
    api.getHistory().then(d=>{ const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }).catch(()=>{});

    if (fail > 0) alert(`완료: ${ok}건 성공, ${fail}건 실패`);
    else if (ok > 0) alert(`${ok}건이 휴지통으로 이동됐습니다.`);
  };

  const save = () => {
    if (!form.gccode && !form.modelname && !form.imedcode) return alert("GC자산코드 또는 모델명을 입력하세요.");

    // ── 아이메드코드 중복 체크
    // form.id가 있으면 수정 모드 → 자기 자신(같은 id) 제외하고 검사
    // form.id가 없으면 신규 등록 모드 → 전체 대상 검사
    if (form.imedcode && form.imedcode.trim()) {
      const selfId = form.id ? String(form.id) : null;
      const dup = data.find(h =>
        h.imedcode &&
        h.imedcode.trim().toLowerCase() === form.imedcode.trim().toLowerCase() &&
        (selfId === null || String(h.id) !== selfId)  // 수정 시 본인 id 제외
      );
      if (dup) {
        return alert(
          `⚠️ 아이메드코드 중복\n\n입력한 코드 "${form.imedcode}"는 이미 등록된 자산에 사용 중입니다.\n\n` +
          `· GC코드: ${dup.gccode||"-"}\n` +
          `· 모델명: ${dup.modelname||"-"}\n` +
          `· 사용자: ${dup.username||"-"}\n` +
          `· 지점: ${CLINICS[dup.clinic]||dup.clinic||"-"}\n\n` +
          `아이메드코드를 다시 확인해 주세요.`
        );
      }
    }

    setLoading(true);
    const isAdd = !form.id;   // id가 없으면 신규, 있으면 수정
    // 번호 자동입력: 등록 시 num 자동 부여 (hwnum은 DB에 없으므로 제외)
    let formData = form;
    if (isAdd && !form.num) {
      const maxNum = Math.max(0, ...data.map(h => parseInt(h.num||0)||0));
      formData = { ...form, num: maxNum + 1 };
    }
    // 신규 등록 시 등록자·등록일시 자동 기록 (수정 시에는 기존값 유지)
    if (isAdd) {
      formData = {
        ...formData,
        registered_by: currentUser?.name || currentUser?.loginid || "알 수 없음",
        registered_at: nowISO(),
      };
    }
    const before = isAdd ? "" : JSON.stringify(data.find(h=>h.id===formData.id)||{});
    const req = isAdd ? api.addHW(formData) : api.updateHW(formData.id, formData);
    req.then(()=>api.getHW()).then(list=>{
      const fresh = Array.isArray(list)?list:[];
      setHw(fresh);
      const name = formData.gccode||formData.modelname||formData.imedcode||"자산";
      const after = JSON.stringify(formData);
      if (isAdd) { const c=fresh.find(h=>h.gccode===formData.gccode); addHistory("하드웨어 등록","hardware",c?.id??"",name,"신규 등록","",after); }
      else         addHistory("하드웨어 수정","hardware",formData.id,name,"정보 수정",before,after);
      setModal(null);
    }).catch(err=>alert(`오류: ${err.message}`)).finally(()=>setLoading(false));
  };

  const deleteItem = (item) => {
    const name = item.gccode||item.modelname||"자산";
    if (!window.confirm(`"${name}"을(를) 휴지통으로 이동하시겠습니까?`)) return;
    // ① 휴지통 저장 먼저 → ② 성공 후 원본 삭제 (데이터 유실 방지)
    api.addTrash({ item_data: item, table_name:"assets", deletedat:nowISO() })
      .then(added => {
        const t = Array.isArray(added) ? added[0] : added;
        return api.deleteHW(item.id).then(() => t);
      })
      .then(t => {
        setHw(prev=>prev.filter(h=>h.id!==item.id));
        if(t && t.id) setTrash(prev=>[...prev,t]);
        addHistory("하드웨어 삭제","hardware",item.id,name,"휴지통 이동",JSON.stringify(item),"");
      }).catch(err=>alert("삭제 오류: "+err.message));
  };

  // 📋 가져오기 양식 다운로드
  const downloadTemplate = () => {
    const header = HW_FIELDS.filter(f => f.key !== "num").map(f => f.label).join(",");
    const example = HW_FIELDS.filter(f => f.key !== "num").map(f => {
      const ex = {
        "자산상태":"사용중","지점":"강남의원","실사날짜":"2025-01-15",
        "GC자산코드(SAP)":"5800001141","아이메드코드":"GCSF-PC-001",
        "제조번호":"SN123456","IP":"192.168.1.100","팀(부서명)":"HIS개발팀",
        "사용자":"홍길동","PC 이름":"O034052","모델명":"NT901X5J",
        "자산구분":"노트북","비고(이력관리)":"정상사용중","MAC Address":"AA:BB:CC:DD:EE:FF",
        "자산 수령일":"2023-01-01","구입일자":"2023-01-01","제조사":"삼성",
        "CPU":"i5-7200U","Memory":"8GB","하드디스크":"SSD 256GB",
        "목적/기능":"업무용","법인":"GC케어","위치(건물)":"여의도파크원",
        "구매정보(전자결재)":"전자결재001"
      };
      return `"${(ex[f.label]||"").replace(/"/g,'""')}"`;
    }).join(",");
    const csv = "\uFEFF" + [header, example].join("\n");
    triggerDownload(new Blob([csv],{type:"text/csv;charset=utf-8"}), "장비가져오기_양식.csv");
  };

  const exportCSV = () => {
    const header = HW_FIELDS.map(f=>f.label).join(",");
    const rows = data.map(item=>HW_FIELDS.map(f=>`"${String(item[f.key]??"").replace(/"/g,'""')}"`).join(","));
    triggerDownload(new Blob(["\uFEFF"+[header,...rows].join("\n")],{type:"text/csv;charset=utf-8"}),`장비목록_${todayStr()}.csv`);
  };
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const d = data.map(item=>{ const r={}; HW_FIELDS.forEach(f=>{r[f.label]=item[f.key]??""}); return r; });
      const ws = XLSX.utils.json_to_sheet(d); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"장비목록"); XLSX.writeFile(wb,`장비목록_${todayStr()}.xlsx`);
    } catch { alert("xlsx 패키지를 설치하세요: npm install xlsx"); }
  };
  // 한글 라벨 → enum 키 역방향 맵 (가져오기 시 변환용)
  // "all" 같은 필터 전용 키는 제외하고 실제 저장 가능한 값만 포함
  const LABEL_TO_KEY = (dict, excludeKeys=[]) =>
    Object.fromEntries(Object.entries(dict).filter(([k])=>!excludeKeys.includes(k)).map(([k,v])=>[v,k]));
  const CLINIC_LABEL_MAP      = LABEL_TO_KEY(CLINICS, ["all"]);
  const ASSETSTATUS_LABEL_MAP = LABEL_TO_KEY(ASSET_STATUS);
  const ASSETTYPE_LABEL_MAP   = LABEL_TO_KEY(ASSET_TYPES);

  // select 필드별 유효 키 집합 (이미 올바른 값인지 판단용)
  const VALID_CLINIC_KEYS      = new Set(Object.keys(CLINICS).filter(k=>k!=="all"));
  const VALID_ASSETSTATUS_KEYS = new Set(Object.keys(ASSET_STATUS));
  const VALID_ASSETTYPE_KEYS   = new Set(Object.keys(ASSET_TYPES));

  // DB에 한글로 잘못 저장된 clinic/assetstatus/assettype 값을 일괄 수정
  const fixKoreanValues = async () => {
    // 각 항목별로 변환이 필요한 필드만 추려낸다
    const targets = data
      .map(h => {
        const patch = {};
        // clinic: 유효 키가 아니고, 한글 맵에 있으면 변환
        if (h.clinic && !VALID_CLINIC_KEYS.has(h.clinic) && CLINIC_LABEL_MAP[h.clinic])
          patch.clinic = CLINIC_LABEL_MAP[h.clinic];
        // assetstatus: 유효 키가 아니고, 한글 맵에 있으면 변환
        if (h.assetstatus && !VALID_ASSETSTATUS_KEYS.has(h.assetstatus) && ASSETSTATUS_LABEL_MAP[h.assetstatus])
          patch.assetstatus = ASSETSTATUS_LABEL_MAP[h.assetstatus];
        // assettype: 유효 키가 아니고, 한글 맵에 있으면 변환
        if (h.assettype && !VALID_ASSETTYPE_KEYS.has(h.assettype) && ASSETTYPE_LABEL_MAP[h.assettype])
          patch.assettype = ASSETTYPE_LABEL_MAP[h.assettype];
        return Object.keys(patch).length > 0 ? { item: h, patch } : null;
      })
      .filter(Boolean);

    if (targets.length === 0) {
      alert("수정할 항목이 없습니다.\n모든 지점/상태/구분 값이 이미 올바르게 저장되어 있습니다.");
      return;
    }

    // 미리보기: 어떤 값들이 바뀌는지 요약
    const preview = targets.slice(0, 5).map(({ item, patch }) =>
      `· ${item.gccode||item.modelname||item.imedcode||"(코드없음)"}: ${Object.entries(patch).map(([k,v])=>{
        const orig = item[k];
        const label = { clinic:"지점", assetstatus:"자산상태", assettype:"자산구분" }[k];
        return `${label} "${orig}" → "${v}"`;
      }).join(", ")}`
    ).join("\n");
    const more = targets.length > 5 ? `\n  ... 외 ${targets.length-5}건` : "";

    if (!window.confirm(
      `한글 값이 감지된 ${targets.length}건을 수정합니다.\n\n${preview}${more}\n\n계속하시겠습니까?`
    )) return;

    setFixLoading(true);
    let ok = 0, fail = 0;
    for (const { item, patch } of targets) {
      try {
        await api.updateHW(item.id, patch);
        await addHistory(
          "데이터 수정(한글→키 변환)", "hardware", item.id,
          item.gccode||item.modelname||"자산",
          `자동수정: ${Object.entries(patch).map(([k,v])=>`${k}: "${item[k]}"→"${v}"`).join(", ")}`,
          JSON.stringify(item), JSON.stringify({...item,...patch})
        );
        ok++;
      } catch { fail++; }
    }
    const fresh = await api.getHW();
    setHw(Array.isArray(fresh)?fresh:[]);
    setFixLoading(false);
    alert(`완료: ${ok}건 수정${fail>0?`, ${fail}건 실패`:""}`);
  };

  const parseCSVLine = (line) => {
    const res=[]; let cur=""; let inQ=false;
    for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(c===","&&!inQ){res.push(cur.trim());cur="";}else cur+=c;}
    res.push(cur.trim()); return res;
  };
  const handleImport = async (e) => {
    const file=e.target.files[0]; if(!file) return;
    setImportLoading(true);
    try {
      let rawRows=[];
      if(file.name.toLowerCase().endsWith(".csv")){
        const text=(await file.text()).replace(/^\uFEFF/,"");
        const lines=text.split(/\r?\n/).filter(l=>l.trim());
        const headers=parseCSVLine(lines[0]);
        rawRows=lines.slice(1).map(line=>{const v=parseCSVLine(line);const o={};headers.forEach((h,i)=>{o[h]=v[i]||"";});return o;});
      } else {
        const XLSX=await import("xlsx");
        const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:"array"});
        rawRows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      }
      const existingMaxNum = Math.max(0, ...data.map(h => parseInt(h.num||0)||0));
      const items=rawRows.filter(r=>Object.values(r).some(v=>v!=="")).map((row,idx)=>{
        const item={};
        HW_FIELDS.forEach(f=>{
          const val=row[f.label]!==undefined?row[f.label]:(row[f.key]!==undefined?row[f.key]:"");
          item[f.key] = val!=="" ? val : null;
        });
        // 한글 라벨로 입력된 경우 enum 키로 변환 (이미 유효 키면 그대로 유지)
        if(item.clinic      && !VALID_CLINIC_KEYS.has(item.clinic))
          item.clinic      = CLINIC_LABEL_MAP[item.clinic]      ?? item.clinic;
        if(item.assetstatus && !VALID_ASSETSTATUS_KEYS.has(item.assetstatus))
          item.assetstatus = ASSETSTATUS_LABEL_MAP[item.assetstatus] ?? item.assetstatus;
        if(item.assettype   && !VALID_ASSETTYPE_KEYS.has(item.assettype))
          item.assettype   = ASSETTYPE_LABEL_MAP[item.assettype]   ?? item.assettype;
        if(!item.assetstatus) item.assetstatus = "active";
        if(!item.assettype)   item.assettype   = "laptop";
        item.num = existingMaxNum + idx + 1;
        // 파일 가져오기 시 등록자·등록일시 자동 기록
        item.registered_by = currentUser?.name || currentUser?.loginid || "알 수 없음";
        item.registered_at = nowISO();
        return item;
      });
      if(!items.length){alert("데이터 없음");return;}
      const MAX_IMPORT = 1000;
      if(items.length > MAX_IMPORT){
        alert(`한 번에 최대 ${MAX_IMPORT}건까지 가져올 수 있습니다.\n현재 ${items.length}건 → 처음 ${MAX_IMPORT}건만 가져옵니다.`);
        items.splice(MAX_IMPORT);
      }
      if(!window.confirm(`${items.length}건을 가져오시겠습니까?\n\n⚠️ 한 번에 최대 1000건까지 등록 가능합니다.`)) return;
      const res=await fetch(`${BASE_URL}/assets`,{method:"POST",headers:{...H,"Prefer":"return=representation"},body:JSON.stringify(items.map(sanitizeHW))});
      if(!res.ok){throw new Error(await res.text());}
      const inserted = await res.clone().json().catch(()=>items);
      await api.getHW().then(list=>setHw(Array.isArray(list)?list:[]));
      // 파일 전체 요약 로그
      const gcCodes = items.map(it=>it.gccode||it.modelname||it.imedcode||"-").join(", ");
      const summary = `파일명: ${file.name} / ${items.length}건 / GC코드: ${gcCodes.length>200?gcCodes.slice(0,200)+"...":gcCodes}`;
      await addHistory("파일 가져오기","hardware","",`${items.length}건`,summary,"",JSON.stringify(items.map(it=>({num:it.num,gccode:it.gccode,imedcode:it.imedcode,modelname:it.modelname,assetstatus:it.assetstatus,clinic:it.clinic,team:it.team,username:it.username}))));
      // 항목별 개별 로그 — 병렬 처리 (silent=true: 매번 재조회 생략)
      await Promise.allSettled(items.map((it, idx) => {
        const name=it.gccode||it.modelname||it.imedcode||`항목${idx+1}`;
        const detail=`파일가져오기 (${file.name}) / 지점:${it.clinic||"-"} / 팀:${it.team||"-"} / 사용자:${it.username||"-"} / 상태:${it.assetstatus||"-"}`;
        return addHistory("장비 등록(가져오기)","hardware","",name,detail,"",JSON.stringify(it), true);
      }));
      // 완료 후 한 번만 재조회
      await Promise.all([
        api.getHistoryCount().then(n=>setHistoryCount(n)),
        api.getDashboardStats().then(s=>setDashStats(s)),
        api.getHistory().then(d=>{ const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }),
      ]);
      alert(`${items.length}건 완료!`);
    } catch(err){ alert("가져오기 실패: "+err.message); }
    finally{ setImportLoading(false); e.target.value=""; }
  };

  // 컬럼 렌더러
  const COL_RENDERERS = {
    num:           h=><span style={{color:"#64748b",fontSize:12,fontWeight:600}}>{h.num ? `HW-${h.num}` : "-"}</span>,
    assetstatus:   h=>{ const s=STATUS_BADGE[h.assetstatus]||{bg:"#f1f5f9",color:"#64748b"}; return <span style={{background:s.bg,color:s.color,padding:"3px 8px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ASSET_STATUS[h.assetstatus]||h.assetstatus||"-"}</span>; },
    clinic:        h=><span style={{fontSize:12}}>{CLINICS[h.clinic]||h.clinic||"-"}</span>,
    inspectiondate:h=><span style={{fontSize:12}}>{h.inspectiondate||"-"}</span>,
    gccode:        h=><b style={{fontSize:12}}>{h.gccode||"-"}</b>,
    imedcode:      h=><span style={{fontSize:12}}>{h.imedcode||"-"}</span>,
    serialnumber:  h=><span style={{fontSize:12}}>{h.serialnumber||"-"}</span>,
    ip:            h=><span style={{fontSize:12}}>{h.ip||"-"}</span>,
    team:          h=><span style={{fontSize:12}}>{h.team||"-"}</span>,
    username:      h=><span style={{fontSize:12}}>{h.username||"-"}</span>,
    pcname:        h=><span style={{fontSize:12}}>{h.pcname||"-"}</span>,
    modelname:     h=><span style={{fontSize:12}}>{h.modelname||"-"}</span>,
    assettype:     h=><span style={{fontSize:12}}>{ASSET_TYPES[h.assettype]||h.assettype||"-"}</span>,
    notes:         h=><span style={{fontSize:12,maxWidth:120,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.notes||"-"}</span>,
    macaddress:    h=><span style={{fontSize:11}}>{h.macaddress||"-"}</span>,
    receiptdate:   h=><span style={{fontSize:12}}>{h.receiptdate||"-"}</span>,
    purchasedate:  h=><span style={{fontSize:12}}>{h.purchasedate||"-"}</span>,
    manufacturer:  h=><span style={{fontSize:12}}>{h.manufacturer||"-"}</span>,
    cpu:           h=><span style={{fontSize:12}}>{h.cpu||"-"}</span>,
    memory:        h=><span style={{fontSize:12}}>{h.memory||"-"}</span>,
    hdd:           h=><span style={{fontSize:12}}>{h.hdd||"-"}</span>,
    purpose:       h=><span style={{fontSize:12}}>{h.purpose||"-"}</span>,
    corporation:   h=><span style={{fontSize:12}}>{h.corporation||"-"}</span>,
    location:      h=><span style={{fontSize:12}}>{h.location||"-"}</span>,
    purchaseinfo:  h=><span style={{fontSize:12}}>{h.purchaseinfo||"-"}</span>,
    registered_by: h=><span style={{fontSize:12,color:"#0f6e56",fontWeight:600}}>{h.registered_by||"-"}</span>,
    registered_at: h=><span style={{fontSize:12,color:"#64748b"}}>{h.registered_at?new Date(h.registered_at).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"-"}</span>,
  };

  const allPageIds = pagedRows.map(h=>h.id);
  const isAllChecked = allPageIds.length>0 && allPageIds.every(id=>selectedIds.has(id));

  const activeCols = useMemo(() => {
    const cols = [
      {
        label: () => (
          <input type="checkbox" checked={isAllChecked}
            onChange={e=>{ const n=new Set(selectedIds); if(e.target.checked){allPageIds.forEach(id=>n.add(id));}else{allPageIds.forEach(id=>n.delete(id));} setSelectedIds(n); }}
            style={{accentColor:"#0f6e56",width:15,height:15,cursor:"pointer",display:"block",margin:"0 auto"}} />
        ),
        minWidth:46, noClip:true,
        render: h=>(
          <input type="checkbox" checked={selectedIds.has(h.id)}
            onChange={e=>{ const n=new Set(selectedIds); e.target.checked?n.add(h.id):n.delete(h.id); setSelectedIds(n); }}
            onClick={e=>e.stopPropagation()}
            style={{accentColor:"#0f6e56",width:15,height:15,cursor:"pointer",display:"block",margin:"0 auto"}} />
        )
      },
      ...ALL_HW_COLS.filter(c=>visibleCols.has(c.key)).map(c=>({ key:c.key, label:c.label, render:COL_RENDERERS[c.key]||(h=>h[c.key]||"-") }))
    ];
    cols.push({ label:"관리", minWidth: canEdit ? 190 : 120, noClip:true, render: h=>(
    <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
      <Btn onClick={()=>{setDetailItem(h);setModal("detail");}} style={{fontSize:11,padding:"5px 7px"}}>상세</Btn>
      <Btn onClick={()=>{setQrItem(h);setModal("qr");}}         style={{fontSize:11,padding:"5px 7px"}}>QR</Btn>
      {canEdit && <Btn onClick={()=>{setForm({...h});setModal("edit");}}    style={{fontSize:11,padding:"5px 7px"}}>수정</Btn>}
      {canEdit && <Btn onClick={()=>deleteItem(h)} variant="danger"         style={{fontSize:11,padding:"5px 7px"}}>삭제</Btn>}
    </div>
  )});
    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCols, selectedIds, isAllChecked, canEdit, pagedRows]);

  return (
    <div>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
          <h2 style={{margin:0,fontSize:20}}>하드웨어 <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>전체 {data.length}건{filtered.length!==data.length?` · 필터 ${filtered.length}건`:""}{selectedIds.size>0?` · 선택 ${selectedIds.size}건`:""}</span></h2>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{display:"none"}}/>
            <Btn onClick={()=>fileInputRef.current?.click()} disabled={importLoading}>{importLoading?"가져오는 중...":"📂 가져오기"}</Btn>
            <Btn onClick={downloadTemplate}>📋 양식 다운로드</Btn>
            {canEdit && (
              <Btn onClick={fixKoreanValues} disabled={fixLoading}
                style={{background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa"}}>
                {fixLoading?"수정 중...":"🔧 한글값 일괄수정"}
              </Btn>
            )}
            <Btn onClick={exportCSV}>⬇️ CSV</Btn>
            <Btn onClick={exportExcel}>⬇️ Excel</Btn>
            <div ref={colMenuRef} style={{position:"relative"}}>
              <Btn onClick={()=>setShowColMenu(v=>!v)}>🔧 컬럼 {visibleCols.size}/{ALL_HW_COLS.length}</Btn>
              {showColMenu && (
                <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",zIndex:500,padding:14,width:260}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:"1px solid #f0f0f0"}}>
                    <span style={{fontSize:12,fontWeight:700}}>컬럼 선택</span>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>toggleAll(true)}  style={{fontSize:11,color:"#0f6e56",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>전체</button>
                      <button onClick={()=>toggleAll(false)} style={{fontSize:11,color:"#cf1322",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>초기화</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,maxHeight:300,overflowY:"auto"}}>
                    {ALL_HW_COLS.map(c=>(
                      <label key={c.key} style={{display:"flex",alignItems:"center",gap:5,padding:"4px",borderRadius:6,cursor:"pointer",fontSize:12,
                        background:visibleCols.has(c.key)?"#e8f5e9":"transparent",color:visibleCols.has(c.key)?"#0f6e56":"#64748b",fontWeight:visibleCols.has(c.key)?600:400}}>
                        <input type="checkbox" checked={visibleCols.has(c.key)} onChange={()=>toggleCol(c.key)} style={{accentColor:"#0f6e56",width:12,height:12}}/>
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0f0f0",fontSize:11,color:"#94a3b8"}}>💾 계정별 자동 저장됩니다</div>
                </div>
              )}
            </div>
            <Btn onClick={()=>setView("qrscan")} style={{background:"#0f6e56",color:"#fff",border:"none"}}>📷 QR 스캔</Btn>
            {canEdit && <Btn onClick={()=>{setForm({assetstatus:"active",assettype:"laptop"});setModal("add");}} variant="primary">+ 등록</Btn>}
            {canEdit && selectedIds.size>0 && (
              <Btn onClick={deleteSelected} variant="danger" style={{minWidth:"max-content"}}>🗑️ 선택삭제 ({selectedIds.size})</Btn>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:160}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}>🔍</span>
            <input placeholder="GC코드, 사용자, 팀, 모델명 검색..." value={searchText} onChange={e=>setSearchText(e.target.value)}
              style={{width:"100%",padding:"9px 30px",borderRadius:10,border:"1px solid #ddd",fontSize:13,boxSizing:"border-box"}}/>
            {searchText && <button onClick={()=>setSearchText("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
          </div>
          <select value={filterClinic} onChange={e=>setFilterClinic(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            <option value="">상태 전체</option>
            {Object.entries(ASSET_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            <option value="">구분 전체</option>
            {Object.entries(ASSET_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          {(searchText||filterStatus||filterType||filterClinic!=="all") && <Btn onClick={()=>{setSearchText("");setFilterStatus("");setFilterType("");setFilterClinic("all");}}>초기화</Btn>}
        </div>
      </div>

      {/* 페이지 크기 + 페이지네이션 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
          <span>페이지당</span>
          <select value={pageSize} onChange={e=>{const v=Number(e.target.value);setPageSize(v);setCurrentPage(1);try{localStorage.setItem(hwPageSizeKey,v);}catch{}}}
            style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {[10,20,50,100,500,1000,0].map(n=><option key={n} value={n}>{n===0?"전체보기":n+"개"}</option>)}
          </select>
          <span style={{fontSize:12}}>({pageSize===0?"전체":filtered.length===0?"0":((currentPage-1)*pageSize+1)+"–"+Math.min(currentPage*pageSize,filtered.length)} / {filtered.length}건)</span>
        </div>
        {totalPages>1 && (
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
            <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p = currentPage<=3 ? i+1 : currentPage+i-2;
              if(p>totalPages) return null;
              return <Btn key={p} onClick={()=>setCurrentPage(p)}
                style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;
            })}
            <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
            <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
          </div>
        )}
      </div>
      <ResponsiveTable cols={activeCols} rows={pagedRows} empty="등록된 자산이 없습니다."
        onRowDoubleClick={(row)=>{setDetailItem(row);setModal("detail");}} />

      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?"새 자산 등록":"자산 정보 수정"} onClose={()=>setModal(null)}>
          <HWForm form={form} setForm={setForm} onSave={save} loading={loading} isEdit={modal==="edit"} />
        </Modal>
      )}
      {modal==="detail" && detailItem && (
        <Modal title={`상세 — ${detailItem.gccode||detailItem.modelname||""}`} onClose={()=>setModal(null)}>
          <HWDetail item={detailItem} />
          {canEdit && (
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #e2e8f0"}}>
              <Btn onClick={()=>{setForm({...detailItem});setModal("edit");}} variant="primary" style={{width:"100%",padding:12}}>
                ✏️ 이 자산 수정하기
              </Btn>
            </div>
          )}
        </Modal>
      )}
      {modal==="qr" && qrItem && (
        <Modal title={`QR 코드 — ${qrItem.gccode||qrItem.modelname||""}`} onClose={()=>setModal(null)}>
          <QRModal item={qrItem} />
        </Modal>
      )}
    </div>
  );
}

// ── 하드웨어 폼
function HWForm({ form, setForm, onSave, loading, isEdit }) {
  const inp = { padding:"8px 10px", borderRadius:8, border:"1px solid #ddd", fontSize:13, width:"100%", boxSizing:"border-box" };
  return (
    <div style={{maxHeight:"62vh",overflowY:"auto",paddingRight:4}}>
      {HW_SECTIONS.map(sec=>(
        <div key={sec.title} style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#0f6e56",padding:"3px 0 7px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>{sec.title}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {sec.keys.map(key=>{
              const f=HW_FIELD_MAP[key]; if(!f) return null;
              // 번호(num)는 신규 등록 시 자동 부여되므로 숨김
              if(key==="num" && !isEdit) return null;
              // 번호(num) 수정 시엔 읽기전용으로 표시
              if(key==="num" && isEdit) return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label} <span style={{color:"#94a3b8"}}>(자동)</span></span>
                  <input type="number" value={form[key]||""} readOnly style={{...inp,background:"#f8fafc",color:"#94a3b8",cursor:"not-allowed"}}/>
                </label>
              );
              if(f.type==="readonly") return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <div style={{...inp,background:"#f8fafc",color:key==="registered_by"?"#0f6e56":"#64748b",fontWeight:key==="registered_by"?600:400,cursor:"default",border:"1px solid #e2e8f0",lineHeight:"1.4"}}>
                    {key==="registered_at"&&form[key]?new Date(form[key]).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):(form[key]||(!isEdit?"저장 시 자동 입력":"-"))}
                  </div>
                </label>
              );
              if(f.type==="select") return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <select value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} style={inp}>
                    <option value="">선택...</option>
                    {Object.entries(f.options).filter(([k])=>k!=="all").map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              );
              if(f.type==="textarea") return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3,gridColumn:"1 / -1"}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <textarea value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} rows={3} style={{...inp,resize:"vertical"}}/>
                </label>
              );
              return (
                <label key={key} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
                  <input type={f.type} value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} style={inp}/>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <Btn onClick={onSave} variant="primary" disabled={loading} style={{width:"100%",padding:13,marginTop:4}}>{loading?"저장 중...":"저장"}</Btn>
    </div>
  );
}
// ── 하드웨어 상세
function HWDetail({ item }) {
  return (
    <div style={{maxHeight:"62vh",overflowY:"auto"}}>
      {HW_SECTIONS.map(sec=>{
        const vis=sec.keys.filter(k=>item[k]!==undefined&&item[k]!==""&&item[k]!==null);
        if(!vis.length) return null;
        return (
          <div key={sec.title} style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0f6e56",padding:"3px 0 7px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>{sec.title}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {vis.map(key=>{
                const f=HW_FIELD_MAP[key]; if(!f) return null;
                const val=item[key]; const d=f.type==="select"?(f.options?.[val]||val):f.type==="readonly"&&key==="registered_at"&&val?new Date(val).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):String(val??"-");
                return (
                  <div key={key} style={{padding:"8px 10px",background:"#f8fafc",borderRadius:8,gridColumn:f.type==="textarea"?"1 / -1":"auto"}}>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#1e293b",wordBreak:"break-all"}}>{d}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ── QR 코드 모달
function QRModal({ item }) {
  const info = [
    `GC코드: ${item.gccode||"-"}`,
    `모델: ${item.modelname||"-"}`,
    `사용자: ${item.username||"-"}`,
    `팀: ${item.team||"-"}`,
    `지점: ${CLINICS[item.clinic]||item.clinic||"-"}`,
    `상태: ${ASSET_STATUS[item.assetstatus]||item.assetstatus||"-"}`,
    `IP: ${item.ip||"-"}`,
    `S/N: ${item.serialnumber||"-"}`,
  ].join("\n");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(info)}&charset-source=UTF-8`;
  return (
    <div style={{textAlign:"center",padding:"8px 0"}}>
      <img src={qrUrl} alt="QR" style={{width:220,height:220,border:"1px solid #e2e8f0",borderRadius:12,marginBottom:16}}/>
      <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 16px",textAlign:"left",fontSize:12,lineHeight:1.8,marginBottom:16}}>
        {info.split("\n").map((l,i)=><div key={i}>{l}</div>)}
      </div>
      <Btn onClick={()=>window.open(qrUrl,"_blank")} variant="primary">🖨️ QR 이미지 열기</Btn>
    </div>
  );
}

// ================================================================
// 💿 [소프트웨어]
// ================================================================
const SW_FIELDS = [
  { key:"swnum",       label:"번호",           type:"text"     },
  { key:"name",        label:"소프트웨어명",   type:"text"     },
  { key:"category",    label:"카테고리",       type:"select",  options:SW_CATEGORIES },
  { key:"version",     label:"버전",           type:"text"     },
  { key:"vendor",      label:"제조사/벤더",    type:"text"     },
  { key:"licensetype", label:"라이선스 유형",  type:"text"     },
  { key:"licensekey",  label:"라이선스 키",    type:"text"     },
  { key:"quantity",    label:"수량",           type:"number"   },
  { key:"cost",        label:"비용",           type:"text"     },
  { key:"purchasedate",label:"구입일",         type:"text"     },
  { key:"expirydate",  label:"만료일",         type:"text"     },
  { key:"assignedto",  label:"담당자",         type:"text"     },
  { key:"clinic",      label:"지점",           type:"select",  options:CLINICS },
  { key:"status",      label:"상태",           type:"select",  options:SW_STATUS },
  { key:"notes",       label:"비고",           type:"textarea" },
  { key:"registered_by", label:"등록자",          type:"readonly" },
  { key:"registered_at", label:"등록일시",         type:"readonly" },
];
const SW_FIELD_MAP  = Object.fromEntries(SW_FIELDS.map(f=>[f.key,f]));
const ALL_SW_COLS   = SW_FIELDS.map(f=>({key:f.key,label:f.label}));
const DEFAULT_SW_COLS = new Set(["swnum","name","category","version","vendor","quantity","expirydate","assignedto","clinic","status","registered_by","registered_at"]);

// localStorage 컬럼 설정 저장/불러오기
const loadColPref = (key, def) => {
  try { const s=localStorage.getItem(key); return s?new Set(JSON.parse(s)):def; } catch { return def; }
};
const saveColPref = (key, set) => {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
};

function SoftwareSection({ data, setSw, addHistory, canEdit, trash, setTrash, currentUser, initClinic, setHistory, setHistoryCount, setDashStats }) {
  const colPrefKey = `sw_cols_${currentUser?.loginid||"default"}`;
  const swPageSizeKey = `sw_pagesize_${currentUser?.loginid||"default"}`;
  const [modal,        setModal]       = useState(null);
  const [form,         setForm]        = useState({});
  const [loading,      setLoading]     = useState(false);
  const [importLoading,setImportLoading]=useState(false);
  const [search,       setSearch]      = useState("");
  const [filterClinic, setFilterClinic]= useState(initClinic||"all");
  const [filterStatus, setFilterStatus]= useState("");
  const [filterCat,    setFilterCat]   = useState("");
  const [showColMenu,  setShowColMenu] = useState(false);
  const [visibleCols,  setVisibleCols] = useState(()=>loadColPref(colPrefKey, DEFAULT_SW_COLS));
  const [selectedIds,  setSelectedIds] = useState(new Set());
  const [pageSize,     setPageSize]    = useState(()=>{ try{const s=localStorage.getItem(swPageSizeKey);return s?Number(s):20;}catch{return 20;} });
  const [currentPage,  setCurrentPage] = useState(1);
  const fileInputRef = useRef(null);
  const colMenuRef   = useRef(null);

  // 사이드바 지점 메뉴 클릭 시 필터 동기화
  useEffect(() => { setFilterClinic(initClinic||"all"); setCurrentPage(1); }, [initClinic]);

  useEffect(()=>{
    const h=(e)=>{if(colMenuRef.current&&!colMenuRef.current.contains(e.target))setShowColMenu(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  const toggleCol = (key) => setVisibleCols(prev=>{
    const n=new Set(prev); n.has(key)?n.delete(key):n.add(key);
    saveColPref(colPrefKey, n); return n;
  });
  const toggleAll = (all) => { const n=all?new Set(ALL_SW_COLS.map(c=>c.key)):new Set(["name"]); saveColPref(colPrefKey,n); setVisibleCols(n); };

  const filtered = useMemo(() => data.filter(s=>{
    const q=search.trim().toLowerCase();
    const mt=!q||[s.name,s.vendor,s.assignedto,s.licensekey,s.version].some(v=>(v||"").toLowerCase().includes(q));
    const mc=filterClinic==="all"||s.clinic===filterClinic;
    const ms=!filterStatus||s.status===filterStatus;
    const mk=!filterCat||s.category===filterCat;
    return mt&&mc&&ms&&mk;
  }), [data, search, filterClinic, filterStatus, filterCat]);

  const totalPages  = pageSize===0?1:Math.ceil(filtered.length/pageSize);
  const pagedRows   = useMemo(() =>
    pageSize===0?filtered:filtered.slice((currentPage-1)*pageSize,currentPage*pageSize),
    [filtered, pageSize, currentPage]);
  useEffect(()=>setCurrentPage(1),[search,filterClinic,filterStatus,filterCat,pageSize]);



  const deleteSelected = async () => {
    if (selectedIds.size === 0) return alert("삭제할 항목을 선택하세요.");
    if (!window.confirm(`선택한 ${selectedIds.size}건을 휴지통으로 이동하시겠습니까?`)) return;

    const items = data.filter(s => selectedIds.has(s.id));
    const BATCH = 10;
    let ok = 0, fail = 0;
    const savedTrash = [];

    // ── 낙관적 UI 업데이트 (즉시 목록에서 제거)
    const deletingIds = new Set(items.map(i=>i.id));
    setSw(prev => prev.filter(s => !deletingIds.has(s.id)));
    setSelectedIds(new Set());

    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(async (item) => {
          const name = item.name||"소프트웨어";
          const trashResult = await api.addTrash({ item_data: item, table_name:"software", deletedat:nowISO() });
          const saved = Array.isArray(trashResult) ? trashResult[0] : trashResult;
          if (!saved?.id) throw new Error("휴지통 저장 실패");
          await api.deleteSW(item.id);
          addHistory("소프트웨어 삭제","software",item.id,name,
            `선택삭제-휴지통 / 벤더:${item.vendor||"-"} / 담당:${item.assignedto||"-"} / 지점:${item.clinic||"-"}`,
            JSON.stringify(item),"", true);
          return saved;
        })
      );
      results.forEach(r => {
        if (r.status === "fulfilled") { savedTrash.push(r.value); ok++; }
        else { fail++; console.error("SW 선택삭제 오류:", r.reason); }
      });
    }

    if (savedTrash.length > 0) setTrash(prev => [...prev, ...savedTrash]);
    const [fresh, newTrash, newCount, newStats] = await Promise.all([
      api.getSW(), api.getTrash(), api.getHistoryCount(), api.getDashboardStats(),
    ]);
    setSw(Array.isArray(fresh)?fresh:[]);
    setTrash(Array.isArray(newTrash)?newTrash:[]);
    setHistoryCount(newCount||0);
    setDashStats(newStats);
    api.getHistory().then(d=>{ const l=Array.isArray(d)?d:[]; setHistory(l.sort((a,b)=>new Date(b.ts)-new Date(a.ts))); }).catch(()=>{});

    if (fail > 0) alert(`완료: ${ok}건 성공, ${fail}건 실패`);
    else if (ok > 0) alert(`${ok}건이 휴지통으로 이동됐습니다.`);
  };

  const save = () => {
    setLoading(true);
    const isAdd = !form.id;   // id가 없으면 신규, 있으면 수정
    const before=isAdd?"":JSON.stringify(data.find(s=>s.id===form.id)||{});
    // 신규 등록 시 등록자·등록일시 자동 기록 (수정 시에는 기존값 유지)
    const formData = isAdd ? {
      ...form,
      registered_by: currentUser?.name || currentUser?.loginid || "알 수 없음",
      registered_at: nowISO(),
    } : form;
    const req=isAdd?api.addSW(formData):api.updateSW(formData.id,formData);
    req.then(()=>api.getSW()).then(list=>{
      setSw(Array.isArray(list)?list:[]);
      addHistory(isAdd?"소프트웨어 등록":"소프트웨어 수정","software",formData.id||"",formData.name,isAdd?"신규 등록":"정보 수정",before,JSON.stringify(formData));
      setModal(null);
    }).catch(err=>alert("오류: "+err.message)).finally(()=>setLoading(false));
  };

  const deleteItem = (item) => {
    if(!window.confirm(`"${item.name}" 휴지통으로 이동?`)) return;
    // ① 휴지통 저장 먼저 → ② 성공 후 원본 삭제 (데이터 유실 방지)
    api.addTrash({item_data: item, table_name:"software", deletedat:nowISO()})
      .then(added => {
        const t = Array.isArray(added) ? added[0] : added;
        return api.deleteSW(item.id).then(() => t);
      })
      .then(async t => {
        setSw(prev=>prev.filter(s=>s.id!==item.id));
        if(t && Object.keys(t).length > 0) setTrash(prev=>[...prev,t]);
        await addHistory("소프트웨어 삭제","software",item.id,item.name,"휴지통 이동",JSON.stringify(item),"");
      }).catch(err=>alert("삭제 오류: "+err.message));
  };

  // 소프트웨어 양식 다운로드
  const downloadSWTemplate = () => {
    const header = SW_FIELDS.map(f=>f.label).join(",");
    const example = SW_FIELDS.map(f=>{
      const ex={"소프트웨어명":"Microsoft Office","카테고리":"오피스","버전":"2021","제조사/벤더":"Microsoft",
        "라이선스 유형":"볼륨라이선스","라이선스 키":"XXXXX-XXXXX-XXXXX","수량":"10","비용":"500000",
        "구입일":"2023-01-01","만료일":"2026-01-01","담당자":"홍길동","지점":"강남의원",
        "상태":"사용중","비고":"연간갱신필요"};
      return `"${(ex[f.label]||"").replace(/"/g,'""')}"`;
    }).join(",");
    const csv="\uFEFF"+[header,example].join("\n");
    triggerDownload(new Blob([csv],{type:"text/csv;charset=utf-8"}),"소프트웨어가져오기_양식.csv");
  };
  const exportCSV = () => {
    const header=SW_FIELDS.map(f=>f.label).join(",");
    const rows=data.map(item=>SW_FIELDS.map(f=>`"${String(item[f.key]??"").replace(/"/g,'""')}"`).join(","));
    triggerDownload(new Blob(["\uFEFF"+[header,...rows].join("\n")],{type:"text/csv;charset=utf-8"}),`소프트웨어목록_${todayStr()}.csv`);
  };
  const exportExcel = async () => {
    try {
      const XLSX=await import("xlsx");
      const d=data.map(item=>{const r={};SW_FIELDS.forEach(f=>{r[f.label]=item[f.key]??""});return r;});
      const ws=XLSX.utils.json_to_sheet(d);const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"소프트웨어목록");XLSX.writeFile(wb,`소프트웨어목록_${todayStr()}.xlsx`);
    } catch{alert("xlsx 패키지를 설치하세요: npm install xlsx");}
  };
  const parseCSVLine=(line)=>{
    const res=[];let cur="";let inQ=false;
    for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(c===","&&!inQ){res.push(cur.trim());cur="";}else cur+=c;}
    res.push(cur.trim());return res;
  };
  const handleImport = async (e) => {
    const file=e.target.files[0]; if(!file) return;
    setImportLoading(true);
    try {
      let rawRows=[];
      if(file.name.toLowerCase().endsWith(".csv")){
        const text=(await file.text()).replace(/^\uFEFF/,"");
        const lines=text.split(/\r?\n/).filter(l=>l.trim());
        const headers=parseCSVLine(lines[0]);
        rawRows=lines.slice(1).map(line=>{const v=parseCSVLine(line);const o={};headers.forEach((h,i)=>{o[h]=v[i]||"";});return o;});
      } else {
        const XLSX=await import("xlsx");
        const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});
        rawRows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      }
      const items=rawRows.filter(r=>Object.values(r).some(v=>v!=="")).map((row)=>{
        const item={status:"active"};
        SW_FIELDS.forEach(f=>{const val=row[f.label]!==undefined?row[f.label]:(row[f.key]!==undefined?row[f.key]:"");if(val!=="")item[f.key]=val;});
        // 파일 가져오기 시 등록자·등록일시 자동 기록
        item.registered_by = currentUser?.name || currentUser?.loginid || "알 수 없음";
        item.registered_at = nowISO();
        return item;
      });
      if(!items.length){alert("데이터 없음");return;}
      const MAX=500;
      if(items.length>MAX){alert(`최대 ${MAX}건까지 가져올 수 있습니다.\n처음 ${MAX}건만 가져옵니다.`);items.splice(MAX);}
      if(!window.confirm(`${items.length}건을 가져오시겠습니까?`)) return;
      const res=await fetch(`${BASE_URL}/software`,{method:"POST",headers:{...H,"Prefer":"return=representation"},body:JSON.stringify(items.map(sanitizeSW))});
      if(!res.ok)throw new Error(await res.text());
      await api.getSW().then(list=>setSw(Array.isArray(list)?list:[]));
      // 파일 전체 요약 로그
      const names = items.map(it=>it.name||"-").join(", ");
      const summary = `파일명: ${file.name} / ${items.length}건 / 소프트웨어: ${names.length>200?names.slice(0,200)+"...":names}`;
      await addHistory("파일 가져오기","software","",`${items.length}건`,summary,"",JSON.stringify(items.map(it=>({name:it.name,category:it.category,vendor:it.vendor,status:it.status,clinic:it.clinic,quantity:it.quantity}))));
      // 항목별 개별 로그 — 순차 await으로 ts 중복 및 번호 충돌 방지
      for(let idx=0;idx<items.length;idx++){
        const it=items[idx];
        const name=it.name||`항목${idx+1}`;
        const detail=`파일가져오기 (${file.name}) / 지점:${it.clinic||"-"} / 담당자:${it.assignedto||"-"} / 상태:${it.status||"-"} / 만료일:${it.expirydate||"-"}`;
        await addHistory("소프트웨어 등록(가져오기)","software","",name,detail,"",JSON.stringify(it));
      }
      alert(`${items.length}건 완료!`);
    } catch(err){alert("가져오기 실패: "+err.message);}
    finally{setImportLoading(false);e.target.value="";}
  };

  // SW 한글값 일괄수정 (clinic, status, category가 한글로 저장된 경우)
  const SW_CLINIC_LABEL_MAP    = Object.fromEntries(Object.entries(CLINICS).filter(([k])=>k!=="all").map(([k,v])=>[v,k]));
  const SW_STATUS_LABEL_MAP    = Object.fromEntries(Object.entries(SW_STATUS).map(([k,v])=>[v,k]));
  const SW_CATEGORY_LABEL_MAP  = Object.fromEntries(Object.entries(SW_CATEGORIES).map(([k,v])=>[v,k]));
  const VALID_SW_CLINIC_KEYS   = new Set(Object.keys(CLINICS).filter(k=>k!=="all"));
  const VALID_SW_STATUS_KEYS   = new Set(Object.keys(SW_STATUS));
  const VALID_SW_CATEGORY_KEYS = new Set(Object.keys(SW_CATEGORIES));
  const [swFixLoading, setSwFixLoading] = useState(false);

  const fixSWKoreanValues = async () => {
    const targets = data.map(s => {
      const patch = {};
      if(s.clinic   && !VALID_SW_CLINIC_KEYS.has(s.clinic)   && SW_CLINIC_LABEL_MAP[s.clinic])   patch.clinic   = SW_CLINIC_LABEL_MAP[s.clinic];
      if(s.status   && !VALID_SW_STATUS_KEYS.has(s.status)   && SW_STATUS_LABEL_MAP[s.status])   patch.status   = SW_STATUS_LABEL_MAP[s.status];
      if(s.category && !VALID_SW_CATEGORY_KEYS.has(s.category)&& SW_CATEGORY_LABEL_MAP[s.category]) patch.category = SW_CATEGORY_LABEL_MAP[s.category];
      return Object.keys(patch).length > 0 ? {item:s, patch} : null;
    }).filter(Boolean);
    if(targets.length===0){ alert("수정할 항목이 없습니다.\n모든 지점/상태/카테고리 값이 이미 올바르게 저장되어 있습니다."); return; }
    const preview = targets.slice(0,5).map(({item,patch})=>
      `· ${item.name||"(이름없음)"}: ${Object.entries(patch).map(([k,v])=>`${k} "${item[k]}"→"${v}"`).join(", ")}`
    ).join("\n");
    const more = targets.length>5?`\n... 외 ${targets.length-5}건`:"";
    if(!window.confirm(`한글 값이 감지된 ${targets.length}건을 수정합니다.\n\n${preview}${more}\n\n계속하시겠습니까?`)) return;
    setSwFixLoading(true);
    let ok=0, fail=0;
    for(const {item,patch} of targets){
      try{
        await api.updateSW(item.id, patch);
        await addHistory("데이터 수정(한글→키 변환)","software",item.id,item.name||"소프트웨어",
          `자동수정: ${Object.entries(patch).map(([k,v])=>`${k}: "${item[k]}"→"${v}"`).join(", ")}`,
          JSON.stringify(item), JSON.stringify({...item,...patch}));
        ok++;
      } catch{ fail++; }
    }
    const fresh = await api.getSW();
    setSw(Array.isArray(fresh)?fresh:[]);
    setSwFixLoading(false);
    alert(`완료: ${ok}건 수정${fail>0?`, ${fail}건 실패`:""}`);
  };

  // SW 컬럼 렌더러
  const SW_RENDERERS = {
    swnum:       (s,ri)=><span style={{color:"#64748b",fontSize:12,fontWeight:600}}>{`SW-${(ri??0)+1}`}</span>,
    name:        s=><b style={{fontSize:13}}>{s.name||"-"}</b>,
    category:    s=>SW_CATEGORIES[s.category]||s.category||"-",
    version:     s=>s.version||"-",
    vendor:      s=>s.vendor||"-",
    licensetype: s=>s.licensetype||"-",
    licensekey:  s=><span style={{fontSize:11,fontFamily:"monospace"}}>{s.licensekey||"-"}</span>,
    quantity:    s=>s.quantity||"-",
    cost:        s=>s.cost||"-",
    purchasedate:s=>s.purchasedate||"-",
    expirydate:  s=>{const exp=s.expirydate;const isExp=exp&&new Date(exp)<new Date();return <span style={{color:isExp?"#cf1322":"inherit",fontWeight:isExp?700:400}}>{exp||"-"}</span>;},
    assignedto:  s=>s.assignedto||"-",
    clinic:      s=>CLINICS[s.clinic]||s.clinic||"-",
    status:      s=>{const b=STATUS_BADGE[s.status]||{bg:"#f1f5f9",color:"#64748b"};return <span style={{background:b.bg,color:b.color,padding:"3px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{SW_STATUS[s.status]||s.status||"-"}</span>;},
    notes:       s=><span style={{fontSize:12,maxWidth:120,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.notes||"-"}</span>,
    registered_by: s=><span style={{fontSize:12,color:"#0f6e56",fontWeight:600}}>{s.registered_by||"-"}</span>,
    registered_at: s=><span style={{fontSize:12,color:"#64748b"}}>{s.registered_at?new Date(s.registered_at).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"-"}</span>,
  };
  const allPageSWIds = pagedRows.map(s=>s.id);
  const isAllSWChecked = allPageSWIds.length>0 && allPageSWIds.every(id=>selectedIds.has(id));
  const activeSWCols = [
    {
      label: ()=>(
        <input type="checkbox" checked={isAllSWChecked}
          onChange={e=>{const n=new Set(selectedIds);if(e.target.checked){allPageSWIds.forEach(id=>n.add(id));}else{allPageSWIds.forEach(id=>n.delete(id));}setSelectedIds(n);}}
          style={{accentColor:"#0f6e56",width:15,height:15,cursor:"pointer",display:"block",margin:"0 auto"}}/>
      ),
      minWidth:46, noClip:true,
      render:s=>(
        <input type="checkbox" checked={selectedIds.has(s.id)}
          onChange={e=>{const n=new Set(selectedIds);e.target.checked?n.add(s.id):n.delete(s.id);setSelectedIds(n);}}
          onClick={e=>e.stopPropagation()}
          style={{accentColor:"#0f6e56",width:15,height:15,cursor:"pointer",display:"block",margin:"0 auto"}}/>
      )
    },
    ...ALL_SW_COLS.filter(c=>visibleCols.has(c.key)).map(c=>({key:c.key,label:c.label,render:SW_RENDERERS[c.key]||(s=>s[c.key]||"-")}))
  ];
  if(canEdit) activeSWCols.push({label:"관리", minWidth:170, noClip:true, render:s=>(
    <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
      <Btn onClick={()=>{setForm({...s});setModal("detail");}} style={{fontSize:11,padding:"5px 7px"}}>상세</Btn>
      <Btn onClick={()=>{setForm({...s});setModal("edit");}} style={{fontSize:11,padding:"5px 7px"}}>수정</Btn>
      <Btn onClick={()=>deleteItem(s)} variant="danger" style={{fontSize:11,padding:"5px 7px"}}>삭제</Btn>
    </div>
  )});

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <h2 style={{margin:0,fontSize:20}}>소프트웨어 <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>전체 {data.length}건{filtered.length!==data.length?` · 필터 ${filtered.length}건`:""}{selectedIds.size>0?` · 선택 ${selectedIds.size}건`:""}</span></h2>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{display:"none"}}/>
          <Btn onClick={()=>fileInputRef.current?.click()} disabled={importLoading}>{importLoading?"가져오는 중...":"📂 가져오기"}</Btn>
          <Btn onClick={downloadSWTemplate}>📋 양식</Btn>
          {canEdit && (
            <Btn onClick={fixSWKoreanValues} disabled={swFixLoading}
              style={{background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa"}}>
              {swFixLoading?"수정 중...":"🔧 한글값 일괄수정"}
            </Btn>
          )}
          <Btn onClick={exportCSV}>⬇️ CSV</Btn>
          <Btn onClick={exportExcel}>⬇️ Excel</Btn>
          {/* 컬럼 선택 */}
          <div ref={colMenuRef} style={{position:"relative"}}>
            <Btn onClick={()=>setShowColMenu(v=>!v)}>🔧 컬럼 {visibleCols.size}/{ALL_SW_COLS.length}</Btn>
            {showColMenu && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",zIndex:500,padding:14,width:240}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:"1px solid #f0f0f0"}}>
                  <span style={{fontSize:12,fontWeight:700}}>컬럼 선택 (자동저장)</span>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>toggleAll(true)}  style={{fontSize:11,color:"#0f6e56",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>전체</button>
                    <button onClick={()=>toggleAll(false)} style={{fontSize:11,color:"#cf1322",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>초기화</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,maxHeight:280,overflowY:"auto"}}>
                  {ALL_SW_COLS.map(c=>(
                    <label key={c.key} style={{display:"flex",alignItems:"center",gap:5,padding:"4px",borderRadius:6,cursor:"pointer",fontSize:12,
                      background:visibleCols.has(c.key)?"#e8f5e9":"transparent",color:visibleCols.has(c.key)?"#0f6e56":"#64748b",fontWeight:visibleCols.has(c.key)?600:400}}>
                      <input type="checkbox" checked={visibleCols.has(c.key)} onChange={()=>toggleCol(c.key)} style={{accentColor:"#0f6e56",width:12,height:12}}/>
                      {c.label}
                    </label>
                  ))}
                </div>
                <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0f0f0",fontSize:11,color:"#94a3b8"}}>💾 계정별 자동 저장됩니다</div>
              </div>
            )}
          </div>
          {canEdit && selectedIds.size>0 && <Btn onClick={deleteSelected} variant="danger" style={{minWidth:"max-content"}}>🗑️ 선택삭제 ({selectedIds.size})</Btn>}
          {canEdit && <Btn onClick={()=>{setForm({status:"active"});setModal("add");}} variant="primary">+ 등록</Btn>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}>🔍</span>
          <input placeholder="이름, 벤더, 담당자 검색..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:"100%",padding:"9px 30px",borderRadius:10,border:"1px solid #ddd",fontSize:13,boxSizing:"border-box"}}/>
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
        </div>
        <select value={filterClinic} onChange={e=>setFilterClinic(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="">상태 전체</option>
          {Object.entries(SW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="">카테고리 전체</option>
          {Object.entries(SW_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        {(search||filterClinic!=="all"||filterStatus||filterCat)&&<Btn onClick={()=>{setSearch("");setFilterClinic("all");setFilterStatus("");setFilterCat("");}}>초기화</Btn>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
          <span>페이지당</span>
          <select value={pageSize} onChange={e=>{const v=Number(e.target.value);setPageSize(v);setCurrentPage(1);try{localStorage.setItem(swPageSizeKey,v);}catch{}}}
            style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {[20,50,100,500,1000,0].map(n=><option key={n} value={n}>{n===0?"전체보기":n+"개"}</option>)}
          </select>
          <span style={{fontSize:12}}>({pageSize===0?"전체":filtered.length===0?"0":((currentPage-1)*pageSize+1)+"–"+Math.min(currentPage*pageSize,filtered.length)} / {filtered.length}건)</span>
        </div>
        {totalPages>1 && (
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
            <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p=currentPage<=3?i+1:currentPage+i-2; if(p>totalPages)return null;
              return <Btn key={p} onClick={()=>setCurrentPage(p)}
                style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;
            })}
            <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
            <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
          </div>
        )}
      </div>
      <ResponsiveTable cols={activeSWCols} rows={pagedRows} empty="등록된 소프트웨어가 없습니다."
        onRowDoubleClick={(row)=>{setForm({...row});setModal("detail");}}/>
      {modal==="detail"&&(
        <Modal title="소프트웨어 상세정보" onClose={()=>setModal(null)}>
          <SWDetailView item={form} onEdit={canEdit?()=>setModal("edit"):null}/>
        </Modal>
      )}
      {(modal==="add"||modal==="edit")&&(
        <Modal title={modal==="add"?"소프트웨어 등록":"소프트웨어 수정"} onClose={()=>setModal(null)}>
          <SWForm form={form} setForm={setForm} onSave={save} loading={loading} isAdd={modal==="add"}/>
        </Modal>
      )}
    </div>
  );
}
function SWDetailView({ item, onEdit }) {
  const inp={padding:"8px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,background:"#f8fafc"};
  const SW_SECTIONS = [
    { title:"📌 기본 정보",   keys:["name","category","version","vendor","status","clinic"] },
    { title:"📋 라이선스",    keys:["licensetype","licensekey","quantity","cost"] },
    { title:"📅 일정",        keys:["purchasedate","expirydate","assignedto"] },
    { title:"📎 비고",        keys:["notes"] },
  ];
  const formatVal = (key, val) => {
    if(!val && val!==0) return "-";
    if(key==="category") return SW_CATEGORIES[val]||val;
    if(key==="status") return SW_STATUS[val]||val;
    if(key==="clinic") return CLINICS[val]||val;
    return String(val);
  };
  return (
    <div style={{maxHeight:"65vh",overflowY:"auto",paddingRight:4}}>
      {SW_SECTIONS.map(sec=>(
        <div key={sec.title} style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8,paddingBottom:4,borderBottom:"1px solid #e2e8f0"}}>{sec.title}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {sec.keys.map(k=>{
              const f=SW_FIELD_MAP[k]; if(!f) return null;
              const isWide = k==="notes"||k==="licensekey";
              return (
                <div key={k} style={{gridColumn:isWide?"1 / -1":"auto"}}>
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:3}}>{f.label}</div>
                  <div style={{...inp,wordBreak:"break-all"}}>{formatVal(k,item[k])}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {onEdit && <Btn onClick={onEdit} variant="primary" style={{width:"100%",padding:12,marginTop:4}}>✏️ 수정하기</Btn>}
    </div>
  );
}

function SWForm({ form, setForm, onSave, loading, isAdd }) {
  const inp={padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:13,width:"100%",boxSizing:"border-box"};
  return (
    <div style={{maxHeight:"62vh",overflowY:"auto",paddingRight:4}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {SW_FIELDS.map(f=>{
          if(f.type==="readonly") return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <div style={{...inp,background:"#f8fafc",color:f.key==="registered_by"?"#0f6e56":"#64748b",fontWeight:f.key==="registered_by"?600:400,cursor:"default",border:"1px solid #e2e8f0",lineHeight:"1.4"}}>
                {f.key==="registered_at"&&form[f.key]?new Date(form[f.key]).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):(form[f.key]||(isAdd?"저장 시 자동 입력":"-"))}
              </div>
            </label>
          );
          if(f.type==="select") return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <select value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}>
                <option value="">선택...</option>
                {Object.entries(f.options).filter(([k])=>k!=="all").map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          );
          if(f.type==="textarea") return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3,gridColumn:"1 / -1"}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <textarea value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} rows={3} style={{...inp,resize:"vertical"}}/>
            </label>
          );
          return (
            <label key={f.key} style={{display:"flex",flexDirection:"column",gap:3}}>
              <span style={{fontSize:11,color:"#64748b"}}>{f.label}</span>
              <input type={f.type} value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}/>
            </label>
          );
        })}
      </div>
      <Btn onClick={onSave} variant="primary" disabled={loading} style={{width:"100%",padding:13}}>{loading?"저장 중...":"저장"}</Btn>
    </div>
  );
}

// ================================================================
// 👤 [사용자 관리]
// ================================================================
function UsersSection({ users, setUsers, addHistory, isAdmin, currentUser }) {
  const usersPageSizeKey = `users_pagesize_${currentUser?.loginid||"default"}`;
  const [modal,   setModal]  = useState(null);
  const [form,    setForm]   = useState({});
  const [loading, setLoading]= useState(false);
  const [pageSize,   setPageSize]   = useState(()=>{ try{const s=localStorage.getItem(usersPageSizeKey);return s?Number(s):20;}catch{return 20;} });
  const [currentPage,setCurrentPage]= useState(1);

  const totalPages = pageSize===0?1:Math.ceil(users.length/pageSize);
  const pagedUsers = pageSize===0?users:users.slice((currentPage-1)*pageSize,currentPage*pageSize);

  // 읽기전용 또는 일반사용자는 관리 불가
  if(!isAdmin) return (
    <div>
      <h2 style={{fontSize:20,marginBottom:20}}>사용자 계정 ({users.length}명)</h2>
      <div style={{background:"#fffbe6",border:"1px solid #ffe58f",borderRadius:14,padding:"16px 20px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
        <span style={{fontSize:20}}>⚠️</span>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#d48806",marginBottom:3}}>접근 제한</div>
          <div style={{fontSize:13,color:"#64748b"}}>사용자 계정 등록·수정·삭제는 <b>관리자</b>만 가능합니다.</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b",marginBottom:8}}>
        <span>페이지당</span>
        <select value={pageSize} onChange={e=>{const v=Number(e.target.value);setPageSize(v);setCurrentPage(1);try{localStorage.setItem(usersPageSizeKey,v);}catch{}}}
          style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          {[20,50,100,500,1000,0].map(n=><option key={n} value={n}>{n===0?"전체보기":n+"개"}</option>)}
        </select>
      </div>
      <ResponsiveTable
        cols={[
          { label:"번호",    minWidth:80,  sortVal:u=>u.usernum||"", render:u=><span style={{color:"#64748b",fontSize:12,fontWeight:600}}>{u.usernum||"-"}</span> },
          { label:"아이디",  key:"loginid", minWidth:130 },
          { label:"이름",    key:"name",    minWidth:110 },
          { label:"부서",    key:"dept",    minWidth:130 },
          { label:"지점",    minWidth:140,  sortVal:u=>CLINICS[u.clinic]||u.clinic||"", render:u=>CLINICS[u.clinic]||u.clinic||"-" },
          { label:"권한",    minWidth:120,  sortVal:u=>ROLES[u.role]||u.role||"", render:u=>{ const r={admin:{bg:"#e8f5e9",c:"#0f6e56"},user:{bg:"#eff6ff",c:"#2563eb"},readonly:{bg:"#f1f5f9",c:"#64748b"}}[u.role]||{bg:"#f1f5f9",c:"#64748b"}; return <span style={{background:r.bg,color:r.c,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{ROLES[u.role]||u.role}</span>; }},
          { label:"계정생성일", minWidth:120, sortVal:u=>u.created_date||u.created_at||"", render:u=>u.created_date||fDate(u.created_at)||"-" },
          { label:"PW변경일",  minWidth:120, sortVal:u=>u.password_changed_date||"", render:u=>u.password_changed_date||"-" },
        ]}
        rows={pagedUsers} empty="사용자가 없습니다."
      />
    </div>
  );

  const save = () => {
    if(!form.loginid||!form.name) return alert("아이디와 이름을 입력하세요.");
    const isAdd = !form.id;
    if(isAdd && !form.password) return alert("비밀번호를 입력하세요.");
    setLoading(true);
    let formData = form;
    if(isAdd && !form.usernum) {
      const maxNum = Math.max(0, ...users.map(u => {
        const m = String(u.usernum||"").match(/(\d+)$/);
        return m ? parseInt(m[1]) : 0;
      }));
      formData = { ...form, usernum: `USR-${maxNum + 1}`, created_date: todayStr(), password_changed_date: todayStr() };
    } else if(!isAdd) {
      const orig = users.find(u=>u.id===form.id);
      if (form.__pwChanged && form.password) {
        // 비밀번호를 실제로 변경한 경우 → 변경일 갱신
        formData = { ...form, password_changed_date: todayStr() };
      } else {
        // 비밀번호 미변경 → 기존 비밀번호 유지
        formData = { ...form, password: orig?.password || form.password };
      }
    }
    // __pwChanged는 UI 전용 플래그 → DB 전송 전 제거
    const { __pwChanged, ...cleanFormData } = formData;
    formData = cleanFormData;
    // NOT NULL 컬럼 보장 (name, loginid)
    if(!formData.name)    formData = { ...formData, name:    users.find(u=>u.id===formData.id)?.name    || formData.name    || "" };
    if(!formData.loginid) formData = { ...formData, loginid: users.find(u=>u.id===formData.id)?.loginid || formData.loginid || "" };

    // ── DB에 실제 존재하는 컬럼만 전송 (없는 컬럼 전송 시 PGRST204 오류 방지)
    // users 테이블의 실제 컬럼 목록 (Supabase schema에 맞게 관리)
    const USERS_DB_COLS = new Set([
      "id","usernum","loginid","name","password","dept","clinic","role",
      "created_date","password_changed_date"  // 이 두 컬럼은 DB에 없으면 자동 제외됨
    ]);
    // 첫 번째 사용자 레코드 키로 실제 DB 컬럼을 동적으로 파악
    const knownCols = users.length > 0 ? new Set(Object.keys(users[0])) : null;
    const allowedCols = knownCols
      ? new Set([...USERS_DB_COLS].filter(c => knownCols.has(c) || c==="id"))
      : USERS_DB_COLS;
    const sanitized = Object.fromEntries(
      Object.entries(formData).filter(([k]) => allowedCols.has(k))
    );

    const req=isAdd?api.addUser(sanitized):api.updateUser(sanitized.id,sanitized);
    req.then(()=>api.getUsers()).then(list=>{
      setUsers(Array.isArray(list)&&list.length?list:[]);
      addHistory(isAdd?"사용자 등록":"사용자 수정","user",form.id||"",form.name,isAdd?"신규 등록":"정보 수정");
      setModal(null);
    }).catch(err=>alert("오류: "+err.message)).finally(()=>setLoading(false));
  };

  const deleteUser = (user) => {
    if(user.id===currentUser?.id) return alert("본인 계정은 삭제할 수 없습니다.");
    if(!window.confirm(`"${user.name}" 계정을 삭제하시겠습니까?`)) return;
    api.deleteUser(user.id).then(()=>api.getUsers()).then(list=>{
      setUsers(Array.isArray(list)&&list.length?list:INIT_USERS);
      addHistory("사용자 삭제","user",user.id,user.name,"계정 삭제");
    }).catch(err=>alert("삭제 오류: "+err.message));
  };

  const inp={padding:"9px 12px",borderRadius:9,border:"1px solid #ddd",fontSize:13,width:"100%",boxSizing:"border-box"};

  const pageSizeUI = (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
        <span>페이지당</span>
        <select value={pageSize} onChange={e=>{const v=Number(e.target.value);setPageSize(v);setCurrentPage(1);try{localStorage.setItem(usersPageSizeKey,v);}catch{}}}
          style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          {[20,50,100,500,1000,0].map(n=><option key={n} value={n}>{n===0?"전체보기":n+"개"}</option>)}
        </select>
        <span style={{fontSize:12}}>({pageSize===0?"전체":users.length===0?"0":((currentPage-1)*pageSize+1)+"–"+Math.min(currentPage*pageSize,users.length)} / {users.length}건)</span>
      </div>
      {totalPages>1 && (
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
          <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{let p=currentPage<=3?i+1:currentPage+i-2;if(p>totalPages)return null;return <Btn key={p} onClick={()=>setCurrentPage(p)} style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;})}
          <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
          <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:20}}>사용자 계정 ({users.length}명)</h2>
        {isAdmin && <Btn onClick={()=>{setForm({role:"user"});setModal("add");}} variant="primary">+ 계정 등록</Btn>}
      </div>
      {pageSizeUI}
      <ResponsiveTable
        cols={[
          { label:"번호",       minWidth:80,  sortVal:u=>u.usernum||"", render:u=><span style={{color:"#64748b",fontSize:12,fontWeight:600}}>{u.usernum||"-"}</span> },
          { label:"아이디",     key:"loginid", minWidth:130 },
          { label:"이름",       key:"name",    minWidth:110 },
          { label:"부서",       key:"dept",    minWidth:130 },
          { label:"지점",       minWidth:140,  sortVal:u=>CLINICS[u.clinic]||u.clinic||"", render:u=>CLINICS[u.clinic]||u.clinic||"-" },
          { label:"권한",       minWidth:120,  sortVal:u=>ROLES[u.role]||u.role||"", render:u=>{ const r={admin:{bg:"#e8f5e9",c:"#0f6e56"},user:{bg:"#eff6ff",c:"#2563eb"},readonly:{bg:"#f1f5f9",c:"#64748b"}}[u.role]||{bg:"#f1f5f9",c:"#64748b"}; return <span style={{background:r.bg,color:r.c,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{ROLES[u.role]||u.role}</span>; }},
          { label:"계정생성일",  minWidth:120,  sortVal:u=>u.created_date||u.created_at||"", render:u=>u.created_date||fDate(u.created_at)||"-" },
          { label:"PW변경일",   minWidth:120,  sortVal:u=>u.password_changed_date||"", render:u=>u.password_changed_date||"-" },
          { label:"관리",       minWidth:170,  noClip:true, render:u=>isAdmin&&(
            <div style={{display:"flex",gap:5,flexWrap:"nowrap"}}>
              <Btn onClick={()=>{setForm({...u});setModal("edit");}} style={{fontSize:11,padding:"5px 8px"}}>수정</Btn>
              <Btn onClick={()=>deleteUser(u)} variant="danger"     style={{fontSize:11,padding:"5px 8px"}}>삭제</Btn>
            </div>
          )},
        ]}
        rows={pagedUsers} empty="사용자가 없습니다."
      />
      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?"계정 등록":"계정 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[{key:"loginid",label:"아이디",type:"text"},{key:"name",label:"이름",type:"text"},{key:"dept",label:"부서",type:"text"}].map(f=>(
              <label key={f.key} style={{display:"flex",flexDirection:"column",gap:4}}>
                <span style={{fontSize:12,color:"#64748b"}}>{f.label}</span>
                <input type={f.type} value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}/>
              </label>
            ))}
            <label style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:12,color:"#64748b"}}>{modal==="edit"?"새 비밀번호 (변경 시만 입력)":"비밀번호"}</span>
              <input type="password"
                value={modal==="edit" ? (form.__pwChanged ? form.password||"" : "") : (form.password||"")}
                placeholder={modal==="edit" ? "••••••••••" : "비밀번호를 입력하세요"}
                onChange={e=>setForm({...form, password:e.target.value, __pwChanged:true})}
                style={inp}/>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:12,color:"#64748b"}}>지점</span>
              <select value={form.clinic||""} onChange={e=>setForm({...form,clinic:e.target.value})} style={inp}>
                {Object.entries(CLINICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:12,color:"#64748b"}}>권한</span>
              <select value={form.role||"user"} onChange={e=>setForm({...form,role:e.target.value})} style={inp}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <Btn onClick={save} variant="primary" disabled={loading} style={{padding:13}}>{loading?"저장 중...":"저장"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ================================================================
// 📝 [히스토리] 카테고리 + 상세 검색
// ================================================================
const HISTORY_CATEGORIES = {
  all:      "전체",
  hardware: "🖥️ 장비",
  software: "💿 소프트웨어",
  user:     "👤 사용자/로그인",
  assets:   "🖥️ 장비(복구)",
  trash:    "🗑️ 휴지통",
};
const CATEGORY_BADGE = {
  hardware: { bg:"#eff6ff", color:"#2563eb" },
  software: { bg:"#f0fdf4", color:"#0f6e56" },
  user:     { bg:"#faf5ff", color:"#7c3aed" },
  assets:   { bg:"#eff6ff", color:"#2563eb" },
  trash:    { bg:"#fff1f0", color:"#cf1322" },
};

function HistorySection({ history, historyCount, currentUser }) {
  const histPageSizeKey = `hist_pagesize_${currentUser?.loginid||"default"}`;
  const [query,      setQuery]      = useState("");
  const [field,      setField]      = useState("all");
  const [filterCat,  setFilterCat]  = useState("all");
  const [filterAction,setFilterAction] = useState("");
  const [showDetail, setShowDetail] = useState(null);
  const [pageSize,   setPageSize]   = useState(()=>{ try{const s=localStorage.getItem(histPageSizeKey);return s?Number(s):20;}catch{return 20;} });
  const [currentPage,setCurrentPage]= useState(1);

  const actions = [...new Set(history.map(h=>h.action).filter(Boolean))].sort();

  const filtered = history.filter(h=>{
    const q = query.trim().toLowerCase();
    const matchQ = !q || (field==="all"
      ? ["username","action","aname","detail","clinic"].some(k=>(h[k]||"").toLowerCase().includes(q))
      : (h[field]||"").toLowerCase().includes(q));
    const matchCat = filterCat==="all" || h.atype===filterCat;
    const matchAct = !filterAction || h.action===filterAction;
    return matchQ && matchCat && matchAct;
  });

  const totalPages = pageSize===0?1:Math.ceil(filtered.length/pageSize);
  const pagedRows  = pageSize===0?filtered:filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  useEffect(()=>setCurrentPage(1),[query,filterCat,filterAction,pageSize]);

  // 카테고리별 카운트
  const catCounts = {};
  history.forEach(h=>{ const k=h.atype||"etc"; catCounts[k]=(catCounts[k]||0)+1; });

  const totalCount = historyCount > 0 ? historyCount : history.length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={{margin:0}}>활동 로그</h2>
        <span style={{fontSize:13,color:"#64748b"}}>
          전체 <b style={{color:"#0f6e56"}}>{totalCount}</b>건
          {(query||filterCat!=="all"||filterAction) && ` · 검색 ${filtered.length}건`}
        </span>
      </div>

      {/* 카테고리 탭 */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {Object.entries(HISTORY_CATEGORIES).map(([k,v])=>{
          const cnt = k==="all" ? totalCount : (catCounts[k]||0);
          if(k!=="all" && cnt===0) return null;
          return (
            <button key={k} onClick={()=>setFilterCat(k)}
              style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background:filterCat===k?"#0f6e56":"#f1f5f9",
                color:filterCat===k?"#fff":"#64748b"}}>
              {v} <span style={{opacity:0.7}}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* 검색 바 */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <select value={field} onChange={e=>setField(e.target.value)}
          style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="all">전체 필드</option>
          <option value="username">수행자</option>
          <option value="action">액션</option>
          <option value="aname">대상</option>
          <option value="detail">상세</option>
          <option value="clinic">지점</option>
        </select>
        <select value={filterAction} onChange={e=>setFilterAction(e.target.value)}
          style={{padding:"9px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
          <option value="">액션 전체</option>
          {actions.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{flex:1,position:"relative",minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}>🔍</span>
          <input type="text" placeholder="수행자, 대상, 상세내용 검색..." value={query} onChange={e=>setQuery(e.target.value)}
            style={{width:"100%",padding:"9px 32px",borderRadius:10,border:"1px solid #ddd",fontSize:13,boxSizing:"border-box"}}/>
          {query&&<button onClick={()=>setQuery("")}
            style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
        </div>
        {(query||filterCat!=="all"||filterAction) &&
          <Btn onClick={()=>{setQuery("");setFilterCat("all");setFilterAction("");}}>초기화</Btn>}
      </div>

      {/* 페이지당 개수 + 페이지네이션 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
          <span>페이지당</span>
          <select value={pageSize} onChange={e=>{const v=Number(e.target.value);setPageSize(v);setCurrentPage(1);try{localStorage.setItem(histPageSizeKey,v);}catch{}}}
            style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {[20,50,100,500,1000,0].map(n=><option key={n} value={n}>{n===0?"전체보기":n+"개"}</option>)}
          </select>
          <span style={{fontSize:12}}>({pageSize===0?"전체":filtered.length===0?"0":((currentPage-1)*pageSize+1)+"–"+Math.min(currentPage*pageSize,filtered.length)} / {filtered.length}건)</span>
        </div>
        {totalPages>1 && (
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
            <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p=currentPage<=3?i+1:currentPage+i-2; if(p>totalPages)return null;
              return <Btn key={p} onClick={()=>setCurrentPage(p)}
                style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;
            })}
            <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
            <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
          </div>
        )}
      </div>

      <ResponsiveTable
        cols={[
          { label:"번호", minWidth:60,
            sortVal: h => { const pos=history.findIndex(x=>(x.id&&x.id===h.id)||(x.ts===h.ts&&x.username===h.username)); return pos>=0?totalCount-pos:0; },
            render:(h)=>{
              const posInHistory = history.findIndex(x=>(x.id&&x.id===h.id)||(x.ts===h.ts&&x.username===h.username));
              const num = posInHistory >= 0 ? totalCount - posInHistory : "-";
              return <span style={{color:"#64748b",fontSize:12}}>{num}</span>;
          }},
          { label:"시간",    minWidth:155, sortVal:h=>h.ts||"",   render:h=><span style={{fontSize:11,whiteSpace:"nowrap",color:"#64748b"}}>{fDT(h.ts)}</span> },
          { label:"수행자",  minWidth:100, key:"username" },
          { label:"카테고리",minWidth:130, sortVal:h=>HISTORY_CATEGORIES[h.atype]||h.atype||"", render:h=>{
            const b=CATEGORY_BADGE[h.atype]||{bg:"#f1f5f9",color:"#64748b"};
            return <span style={{background:b.bg,color:b.color,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
              {HISTORY_CATEGORIES[h.atype]||h.atype||"-"}
            </span>;
          }},
          { label:"액션",    minWidth:170, key:"action", render:h=><span style={{background:"#f1f5f9",padding:"2px 8px",borderRadius:10,fontSize:12}}>{h.action}</span> },
          { label:"대상",    minWidth:130, key:"aname" },
          { label:"상세",    minWidth:240, key:"detail" },
          { label:"지점",    minWidth:120, sortVal:h=>CLINICS[h.clinic]||h.clinic||"", render:h=>CLINICS[h.clinic]||h.clinic||"-" },
          { label:"변경내용",minWidth:90,  noClip:true, render:h=>(h.before||h.after)&&(
            <Btn onClick={()=>setShowDetail(h)} style={{fontSize:11,padding:"4px 8px"}}>보기</Btn>
          )},
        ]}
        rows={pagedRows} empty={query||filterCat!=="all"?"검색 결과 없음":"로그가 없습니다."}
      />
      {showDetail && (
        <Modal title="변경 내용 상세" onClose={()=>setShowDetail(null)}>
          <ChangeDetailView item={showDetail} />
        </Modal>
      )}
    </div>
  );
}


// ================================================================
// 📷 [QR 스캔] 스마트폰 카메라로 아이메드코드 인식
// ================================================================
function QRScannerLoader({ onLoad }) {
  useEffect(() => {
    if (window.jsQR) { onLoad(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    s.onload = onLoad;
    s.onerror = () => console.error("jsQR 로드 실패");
    document.head.appendChild(s);
  }, []);
  return null;
}

// QR 스캔 결과 자산정보 표시 필드 전체 목록 (순서 고정)
const QR_ALL_FIELDS = [
  { key:"gccode",       label:"GC자산코드"   },
  { key:"imedcode",     label:"아이메드코드"  },
  { key:"assetstatus",  label:"자산상태"     },
  { key:"assettype",    label:"자산구분"     },
  { key:"modelname",    label:"모델명"       },
  { key:"serialnumber", label:"제조번호"     },
  { key:"clinic",       label:"지점"         },
  { key:"team",         label:"팀(부서명)"   },
  { key:"username",     label:"사용자"       },
  { key:"pcname",       label:"PC이름"       },
  { key:"ip",           label:"IP"           },
  { key:"macaddress",   label:"MAC Address"  },
  { key:"location",     label:"위치(건물)"   },
  { key:"corporation",  label:"법인"         },
  { key:"manufacturer", label:"제조사"       },
  { key:"cpu",          label:"CPU"          },
  { key:"memory",       label:"Memory"       },
  { key:"hdd",          label:"하드디스크"   },
  { key:"purpose",      label:"목적/기능"    },
  { key:"receiptdate",  label:"수령일"       },
  { key:"purchasedate", label:"구입일"       },
  { key:"purchaseinfo", label:"구매정보"     },
  { key:"inspectiondate",label:"실사날짜"    },
  { key:"notes",        label:"비고"         },
];
const QR_DEFAULT_FIELDS = new Set([
  "gccode","imedcode","assetstatus","assettype","modelname","serialnumber",
  "clinic","team","username","location"
]);

function QRScanSection({ hw, onClose, currentUser }) {
  const qrColKey = `qr_cols_${currentUser?.loginid||"default"}`;
  const [jsQRReady,   setJsQRReady]   = useState(!!window.jsQR);
  const [scanning,    setScanning]    = useState(false);
  const [scanned,     setScanned]     = useState(null);
  const [asset,       setAsset]       = useState(null);
  const [notFound,    setNotFound]    = useState(false);
  const [camError,    setCamError]    = useState("");
  const [showColMenu, setShowColMenu] = useState(false);
  const [visibleQRCols, setVisibleQRCols] = useState(() => loadColPref(qrColKey, QR_DEFAULT_FIELDS));
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const animRef    = useRef(null);
  const colMenuRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggleQRCol = (key) => setVisibleQRCols(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key);
    saveColPref(qrColKey, n); return n;
  });
  const toggleQRAll = (all) => {
    const n = all ? new Set(QR_ALL_FIELDS.map(f=>f.key)) : new Set(["gccode"]);
    saveColPref(qrColKey, n); setVisibleQRCols(n);
  };

  const stopScan = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animRef.current)   cancelAnimationFrame(animRef.current);
    streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => () => stopScan(), []);

  const startScan = async () => {
    setCamError(""); setScanned(null); setAsset(null); setNotFound(false);

    // iOS Safari 호환: width/height constraint 없이 시도 → 실패 시 기본값으로 재시도
    const tryGetStream = async () => {
      // 1차 시도: 후면 카메라 (exact 대신 ideal 사용 — iOS에서 exact는 실패 가능)
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });
      } catch {
        // 2차 시도: constraint 없이 기본 카메라
        return await navigator.mediaDevices.getUserMedia({ video: true });
      }
    };

    try {
      // iOS는 navigator.mediaDevices 자체가 없는 경우도 있음 (비HTTPS 환경)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCamError("이 브라우저는 카메라를 지원하지 않습니다.\niOS는 Safari 브라우저에서만 카메라 접근이 가능합니다.\n또한 반드시 HTTPS(보안) 연결이 필요합니다.");
        return;
      }

      const stream = await tryGetStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari: play()는 반드시 await 처리, autoplay 제한 우회
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("muted", "true");
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // 일부 iOS 버전에서 play() 실패 시 재시도
          await new Promise(r => setTimeout(r, 300));
          await videoRef.current.play();
        }
      }
      setScanning(true);

      const tick = () => {
        const v = videoRef.current; const c = canvasRef.current;
        if (!v || !c || v.readyState < 2) { animRef.current = requestAnimationFrame(tick); return; }
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext("2d"); ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        if (window.jsQR) {
          const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const text = code.data.trim();
            setScanned(text);
            const found = hw.find(h => (h.imedcode || "").trim().toUpperCase() === text.toUpperCase());
            setAsset(found || null);
            setNotFound(!found);
            stopScan(); return;
          }
        }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);

    } catch (err) {
      // iOS/Android별 친절한 오류 안내
      let msg = "카메라 접근 오류";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "📵 카메라 권한이 거부됐습니다.\n\n【아이폰】 설정 → Safari → 카메라 → '허용'으로 변경 후 페이지를 새로고침 하세요.\n【안드로이드】 설정 → 앱 → 브라우저 → 권한 → 카메라 허용";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "카메라를 찾을 수 없습니다. 기기에 카메라가 있는지 확인하세요.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "카메라가 다른 앱에서 사용 중입니다. 다른 앱을 닫고 다시 시도하세요.";
      } else if (err.name === "OverconstrainedError") {
        msg = "카메라 설정 오류입니다. 다시 시도해 주세요.";
      } else if (err.name === "TypeError") {
        msg = "HTTPS 연결이 필요합니다. 보안 연결(https://)로 접속해 주세요.\n아이폰은 반드시 Safari 브라우저를 사용해 주세요.";
      } else {
        msg = `카메라 오류: ${err.message}`;
      }
      setCamError(msg);
    }
  };

  const reset = () => { setScanned(null); setAsset(null); setNotFound(false); setCamError(""); };

  // 자산 필드 값 포맷
  const formatVal = (key, val) => {
    if (!val && val !== 0) return null;
    if (key === "assetstatus") return ASSET_STATUS[val] || val;
    if (key === "assettype")   return ASSET_TYPES[val]  || val;
    if (key === "clinic")      return CLINICS[val]       || val;
    return String(val);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:0 }}>
      <QRScannerLoader onLoad={() => setJsQRReady(true)} />

      {/* 헤더 */}
      {!onClose && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexShrink:0 }}>
          <h2 style={{ fontSize:22, fontWeight:700, margin:0 }}>📷 QR 스캔</h2>
        </div>
      )}

      {/* 스캔 전 안내 + 카메라 + 버튼 — 스크롤 없이 한 화면에 */}
      {!scanned && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, flex:1, minHeight:0 }}>
          {/* 안내 박스 (간결하게) */}
          <div style={{ background:"#e8f5e9", borderRadius:12, padding:"10px 14px", border:"1px solid #a7d7a8", width:"100%", flexShrink:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0f6e56", marginBottom:4 }}>📋 사용 방법</div>
            <div style={{ fontSize:11, color:"#334155", lineHeight:1.7 }}>
              1. 자산 스티커의 QR코드를 찾으세요&nbsp;&nbsp;
              2. QR코드 값 = <b>아이메드 코드</b> (예: GCSF-PC-039)<br/>
              3. 스캔 시작 버튼을 누르고 카메라를 QR코드에 갖다 대세요&nbsp;&nbsp;
              4. 자동 인식 후 자산 상세정보가 표시됩니다
            </div>
          </div>

          {/* 카메라 영역 — 화면 높이에 맞게 유동 */}
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", background:"#000",
            width:"100%", maxWidth:360,
            height: onClose ? 260 : "min(55vw, 280px)",
            flexShrink:0 }}>
            <video ref={videoRef} playsInline muted autoPlay
              style={{ width:"100%", height:"100%", objectFit:"cover", display:scanning?"block":"none" }} />
            {!scanning && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
                <span style={{ fontSize:48 }}>📷</span>
                <span style={{ color:"#fff", fontSize:12 }}>카메라가 여기에 표시됩니다</span>
              </div>
            )}
            {scanning && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                <div style={{ width:"60%", height:"60%", border:"3px solid #0f6e56", borderRadius:12, boxShadow:"0 0 0 9999px rgba(0,0,0,0.35)" }} />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display:"none" }} />

          {camError && (
            <div style={{ color:"#cf1322", fontSize:12, padding:"12px 14px", background:"#fff1f0", borderRadius:10, width:"100%", flexShrink:0, whiteSpace:"pre-line", lineHeight:1.7 }}>
              {camError}
            </div>
          )}

          {/* 스캔 시작/중지 버튼 — 항상 보이도록 flexShrink:0 */}
          <div style={{ flexShrink:0, width:"100%", maxWidth:360 }}>
            {!scanning
              ? <Btn onClick={startScan} variant="primary" disabled={!jsQRReady}
                  style={{ fontSize:15, padding:"13px 0", borderRadius:14, width:"100%", textAlign:"center" }}>
                  {jsQRReady ? "📷 스캔 시작" : "라이브러리 로딩 중..."}
                </Btn>
              : <Btn onClick={stopScan} variant="danger"
                  style={{ fontSize:15, padding:"13px 0", borderRadius:14, width:"100%", textAlign:"center" }}>
                  ⏹ 중지
                </Btn>
            }
            {scanning && <p style={{ color:"#64748b", fontSize:11, marginTop:8, textAlign:"center" }}>QR코드를 카메라 중앙 박스에 맞춰주세요</p>}
          </div>
        </div>
      )}

      {/* 스캔 결과 */}
      {scanned && (
        <div style={{ paddingBottom: 100 }}>
          {/* 인식된 코드 */}
          <div style={{ background:"#f8fafc", borderRadius:12, padding:"12px 16px", marginBottom:12,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2 }}>인식된 코드</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#0f6e56", wordBreak:"break-all" }}>{scanned}</div>
            </div>
          </div>

          {/* 자산 정보 카드 */}
          {asset ? (
            <div style={{ background:"#fff", borderRadius:18, border:"2px solid #0f6e56", padding:16 }}>
              {/* 헤더: 타이틀 + 상태배지 + 컬럼설정 */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <h3 style={{ margin:0, fontSize:15, color:"#0f6e56" }}>✅ 자산 정보</h3>
                  {(() => { const s=STATUS_BADGE[asset.assetstatus]||{bg:"#f1f5f9",color:"#64748b"};
                    return <span style={{ background:s.bg, color:s.color, padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700 }}>{ASSET_STATUS[asset.assetstatus]||asset.assetstatus}</span>; })()}
                </div>
                {/* 컬럼 설정 버튼 */}
                <div ref={colMenuRef} style={{ position:"relative" }}>
                  <Btn onClick={()=>setShowColMenu(v=>!v)} style={{ fontSize:11, padding:"5px 8px" }}>
                    🔧 항목 {visibleQRCols.size}/{QR_ALL_FIELDS.length}
                  </Btn>
                  {showColMenu && (
                    <div style={{
                      position:"fixed",
                      left:"50%", transform:"translateX(-50%)",
                      bottom:80,
                      background:"#fff",
                      border:"1px solid #e2e8f0", borderRadius:14,
                      boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
                      zIndex:9000, padding:14,
                      width:"min(280px, 90vw)"
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, paddingBottom:8, borderBottom:"1px solid #f0f0f0" }}>
                        <span style={{ fontSize:12, fontWeight:700 }}>표시 항목 선택</span>
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={()=>toggleQRAll(true)}  style={{ fontSize:11, color:"#0f6e56", border:"none", background:"none", cursor:"pointer", fontWeight:600 }}>전체</button>
                          <button onClick={()=>toggleQRAll(false)} style={{ fontSize:11, color:"#cf1322", border:"none", background:"none", cursor:"pointer", fontWeight:600 }}>초기화</button>
                          <button onClick={()=>setShowColMenu(false)} style={{ fontSize:11, color:"#94a3b8", border:"none", background:"none", cursor:"pointer" }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2, maxHeight:240, overflowY:"auto" }}>
                        {QR_ALL_FIELDS.map(f => (
                          <label key={f.key} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px", borderRadius:6, cursor:"pointer", fontSize:11,
                            background: visibleQRCols.has(f.key)?"#e8f5e9":"transparent",
                            color: visibleQRCols.has(f.key)?"#0f6e56":"#64748b",
                            fontWeight: visibleQRCols.has(f.key)?600:400 }}>
                            <input type="checkbox" checked={visibleQRCols.has(f.key)} onChange={()=>toggleQRCol(f.key)}
                              style={{ accentColor:"#0f6e56", width:12, height:12 }}/>
                            {f.label}
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #f0f0f0", fontSize:11, color:"#94a3b8" }}>💾 계정별 자동 저장</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 자산 필드 그리드 */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:8 }}>
                {QR_ALL_FIELDS
                  .filter(f => visibleQRCols.has(f.key))
                  .map(f => {
                    const raw = asset[f.key];
                    const val = formatVal(f.key, raw);
                    if (!val) return null;
                    const isWide = f.key === "notes" || f.key === "purchaseinfo";
                    return (
                      <div key={f.key} style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px",
                        gridColumn: isWide ? "1 / -1" : "auto" }}>
                        <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>{f.label}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", wordBreak:"break-all" }}>{val}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : notFound && (
            <div style={{ background:"#fff1f0", borderRadius:16, padding:24, textAlign:"center", border:"1px solid #ffa39e" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>❌</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#cf1322", marginBottom:6 }}>자산을 찾을 수 없습니다</div>
              <div style={{ fontSize:13, color:"#64748b", marginBottom:6 }}>
                아이메드 코드 <b style={{color:"#cf1322"}}>{scanned}</b> 에 해당하는 자산이 없습니다.
              </div>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:14 }}>DB에 해당 아이메드 코드가 등록되어 있는지 확인해주세요.</div>
            </div>
          )}

          {/* 🔄 다시 스캔 버튼 — 카드 바깥, 항상 마지막에 위치 */}
          <div style={{ marginTop:20 }}>
            <Btn onClick={reset} style={{ width:"100%", padding:"14px 0", fontSize:15, textAlign:"center", borderRadius:14 }}>
              🔄 다시 스캔
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// 🗑️ [휴지통]
// ================================================================
function TrashSection({ trash, setTrash, setHw, setSw, addHistory, canEdit, currentUser }) {
  const trashPageSizeKey = `trash_pagesize_${currentUser?.loginid||"default"}`;
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("all");
  const [loading,    setLoading]    = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [pageSize,   setPageSize]   = useState(()=>{ try{const s=localStorage.getItem(trashPageSizeKey);return s?Number(s):20;}catch{return 20;} });
  const [currentPage,setCurrentPage]= useState(1);

  const refreshTrash = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getTrash();
      setTrash(Array.isArray(d) ? d : []);
    } catch(e) { console.error("[TrashSection] refreshTrash error:", e); }
    finally { setLoading(false); }
  }, [setTrash]);

  useEffect(() => { refreshTrash(); }, [refreshTrash]);

  const DB_AUTO_COLS = ["id","created_at","updated_at","deleted_at"];

  const getData = t => {
    if (typeof t.item_data === "string") {
      try { return JSON.parse(t.item_data); } catch { return {}; }
    }
    return t.item_data || {};
  };
  const getTable = t => t.table_name || "assets";

  const filtered = trash.filter(t => {
    const d = getData(t);
    const tb = getTable(t);
    const matchType = filterType === "all" || tb === filterType;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [d.gccode, d.modelname, d.name, d.team, d.assignedto, d.clinic, d.username]
      .some(v => (v || "").toLowerCase().includes(q));
    return matchType && matchSearch;
  });

  const totalPages = pageSize===0?1:Math.ceil(filtered.length/pageSize);
  const pagedRows  = pageSize===0?filtered:filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  useEffect(()=>setCurrentPage(1),[search,filterType,pageSize]);

  const restore = (trashItem) => {
    const orig  = getData(trashItem);
    const table = getTable(trashItem);
    const rest  = Object.fromEntries(Object.entries(orig).filter(([k]) => !DB_AUTO_COLS.includes(k)));
    const name  = rest.gccode || rest.modelname || rest.name || "항목";
    const typeLabel = table === "assets" ? "장비" : "소프트웨어";
    const aType     = table === "assets" ? "hardware" : "software";
    if (!window.confirm(`"${name}"을(를) 복구하시겠습니까?`)) return;
    api.deleteTrash(trashItem.id)
      .then(() => fetch(`${BASE_URL}/${table}`, {
        method:"POST", headers:{...H,"Prefer":"return=representation"}, body: JSON.stringify(rest)
      }).then(safeJson))
      .then(restored => {
        setTrash(prev => prev.filter(t => t.id !== trashItem.id));
        const item = Array.isArray(restored) ? restored[0] : restored;
        if (table === "assets")   setHw(prev => [...prev, item]);
        else if (table === "software") setSw(prev => [...prev, item]);
        addHistory("데이터 복구", aType, item?.id, name,
          `${typeLabel} 휴지통에서 복구`, "", JSON.stringify(rest));
      }).catch(err => alert("복구 오류: " + err.message));
  };

  const deleteForever = (trashItem) => {
    if (!window.confirm("영구 삭제하시겠습니까? 복구 불가합니다.")) return;
    const orig  = getData(trashItem);
    const name  = orig.gccode || orig.modelname || orig.name || "항목";
    const table = getTable(trashItem);
    const aType = table === "assets" ? "hardware" : "software";
    api.deleteTrash(trashItem.id).then(() => {
      setTrash(prev => prev.filter(t => t.id !== trashItem.id));
      addHistory("영구 삭제", aType, trashItem.id, name, "휴지통에서 영구 삭제", JSON.stringify(orig), "");
      refreshTrash();
    }).catch(err => alert("영구삭제 오류: " + err.message));
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <h2 style={{margin:0}}>휴지통 <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>전체 {trash.length}건{filtered.length!==trash.length?` · 필터 ${filtered.length}건`:""}</span></h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <Btn onClick={refreshTrash} disabled={loading} style={{fontSize:12,padding:"7px 12px"}}>
            {loading ? "조회 중..." : "🔄 새로고침"}
          </Btn>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            style={{padding:"8px 10px",borderRadius:10,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            <option value="all">전체</option>
            <option value="assets">장비</option>
            <option value="software">소프트웨어</option>
          </select>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:13}}>🔍</span>
            <input placeholder="GC코드, 모델명, 사용자 검색..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{padding:"8px 10px 8px 28px",borderRadius:10,border:"1px solid #ddd",fontSize:13,width:220}}/>
            {search && <button onClick={()=>setSearch("")}
              style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>✕</button>}
          </div>
        </div>
      </div>

      {/* 페이지당 개수 + 페이지네이션 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#64748b"}}>
          <span>페이지당</span>
          <select value={pageSize} onChange={e=>{const v=Number(e.target.value);setPageSize(v);setCurrentPage(1);try{localStorage.setItem(trashPageSizeKey,v);}catch{}}}
            style={{padding:"5px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:13,background:"#fff"}}>
            {[20,50,100,500,1000,0].map(n=><option key={n} value={n}>{n===0?"전체보기":n+"개"}</option>)}
          </select>
          <span style={{fontSize:12}}>({pageSize===0?"전체":filtered.length===0?"0":((currentPage-1)*pageSize+1)+"–"+Math.min(currentPage*pageSize,filtered.length)} / {filtered.length}건)</span>
        </div>
        {totalPages>1 && (
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <Btn onClick={()=>setCurrentPage(1)}          disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>«</Btn>
            <Btn onClick={()=>setCurrentPage(p=>p-1)}     disabled={currentPage===1}          style={{padding:"5px 10px",fontSize:12}}>‹</Btn>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              let p=currentPage<=3?i+1:currentPage+i-2; if(p>totalPages)return null;
              return <Btn key={p} onClick={()=>setCurrentPage(p)}
                style={{padding:"5px 10px",fontSize:12,background:p===currentPage?"#0f6e56":"#fff",color:p===currentPage?"#fff":"#333",border:"1px solid #ddd"}}>{p}</Btn>;
            })}
            <Btn onClick={()=>setCurrentPage(p=>p+1)}     disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>›</Btn>
            <Btn onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages} style={{padding:"5px 10px",fontSize:12}}>»</Btn>
          </div>
        )}
      </div>

      <ResponsiveTable
        cols={[
          { label:"번호",     minWidth:75,
            sortVal: t => filtered.length - filtered.indexOf(t),
            render:(t)=><span style={{color:"#64748b",fontSize:12,fontWeight:600}}>{`TRS-${filtered.length - filtered.indexOf(t)}`}</span>},
          { label:"구분",     minWidth:110,
            sortVal: t => getTable(t),
            render:t=>{ const tb=getTable(t); return <span style={{background:tb==="assets"?"#eff6ff":"#f0fdf4",color:tb==="assets"?"#2563eb":"#0f6e56",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{tb==="assets"?"🖥️ 장비":"💿 소프트웨어"}</span>; }},
          { label:"이름/코드", minWidth:180,
            sortVal: t=>{ const d=getData(t); return d.gccode||d.modelname||d.name||""; },
            render:t=>{ const d=getData(t); return <span style={{fontWeight:600,fontSize:13}}>{d.gccode||d.modelname||d.name||"-"}</span>; }},
          { label:"모델/버전", minWidth:140,
            sortVal: t=>{ const d=getData(t); return d.modelname||d.version||""; },
            render:t=>{ const d=getData(t); return d.modelname||d.version||"-"; }},
          { label:"팀/담당",  minWidth:130,
            sortVal: t=>{ const d=getData(t); return d.team||d.assignedto||""; },
            render:t=>{ const d=getData(t); return d.team||d.assignedto||"-"; }},
          { label:"사용자",   minWidth:110,
            sortVal: t=>{ const d=getData(t); return d.username||""; },
            render:t=>{ const d=getData(t); return d.username||"-"; }},
          { label:"지점",     minWidth:120,
            sortVal: t=>{ const d=getData(t); return CLINICS[d.clinic]||d.clinic||""; },
            render:t=>{ const d=getData(t); return CLINICS[d.clinic]||d.clinic||"-"; }},
          { label:"상태",     minWidth:110,
            sortVal: t=>{ const d=getData(t); const sk=d.assetstatus||d.status; return ASSET_STATUS[sk]||SW_STATUS[sk]||sk||""; },
            render:t=>{ const d=getData(t); const sk=d.assetstatus||d.status; const b=STATUS_BADGE[sk]||{bg:"#f1f5f9",color:"#64748b"}; return sk?<span style={{background:b.bg,color:b.color,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{ASSET_STATUS[sk]||SW_STATUS[sk]||sk}</span>:"-"; }},
          { label:"삭제일",   minWidth:155,
            sortVal: t => t.deletedat||t.deletedAt||t.created_at||"",
            render:t=>fDT(t.deletedat||t.deletedAt||t.created_at) },
          { label:"관리",     minWidth:260, noClip:true, render:t=>(
            <div style={{display:"flex",gap:5,flexWrap:"nowrap",alignItems:"center"}}>
              <Btn onClick={()=>setDetailItem(t)} style={{fontSize:11,padding:"5px 8px",whiteSpace:"nowrap"}}>🔍 상세</Btn>
              {canEdit && <Btn onClick={()=>restore(t)} variant="warning" style={{fontSize:11,padding:"5px 8px",whiteSpace:"nowrap"}}>🔄 복구</Btn>}
              {canEdit && <Btn onClick={()=>deleteForever(t)} variant="danger" style={{fontSize:11,padding:"5px 8px",whiteSpace:"nowrap"}}>🗑️ 영구삭제</Btn>}
            </div>
          )},
        ]}
        rows={pagedRows} empty={search||filterType!=="all"?"검색 결과가 없습니다.":"휴지통이 비어있습니다."}
        onRowDoubleClick={(t)=>setDetailItem(t)}
      />
      {detailItem && (
        <Modal title="휴지통 상세정보" onClose={()=>setDetailItem(null)}>
          <TrashDetailView trashItem={detailItem} getData={getData} getTable={getTable}
            onRestore={canEdit?()=>{restore(detailItem);setDetailItem(null);}:null}
            onDelete={canEdit?()=>{deleteForever(detailItem);setDetailItem(null);}:null}/>
        </Modal>
      )}
    </div>
  );
}


// ================================================================
// 🗑️ [휴지통 상세보기]
// ================================================================
function TrashDetailView({ trashItem, getData, getTable, onRestore, onDelete }) {
  const d = getData(trashItem);
  const table = getTable(trashItem);
  const isHW = table === "assets";

  const sections = isHW ? HW_SECTIONS : [
    { title:"📌 기본 정보",   keys:["name","category","version","vendor","status","clinic"] },
    { title:"📋 라이선스",    keys:["licensetype","licensekey","quantity","cost"] },
    { title:"📅 일정",        keys:["purchasedate","expirydate","assignedto"] },
    { title:"📎 비고",        keys:["notes"] },
  ];

  const fieldMap = isHW ? HW_FIELD_MAP : SW_FIELD_MAP;

  const formatVal = (key, val) => {
    if(val===null||val===undefined||val==="") return "-";
    if(key==="assetstatus") return ASSET_STATUS[val]||val;
    if(key==="assettype")   return ASSET_TYPES[val]||val;
    if(key==="clinic")      return CLINICS[val]||val;
    if(key==="status")      return SW_STATUS[val]||val;
    if(key==="category")    return SW_CATEGORIES[val]||val;
    return String(val);
  };

  return (
    <div style={{maxHeight:"70vh",overflowY:"auto",paddingRight:4}}>
      <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#c2410c",fontWeight:600}}>
        🗑️ 휴지통 항목 · 삭제일: {fDT(trashItem.deletedat||trashItem.deletedAt||trashItem.created_at)}
      </div>
      {sections.map(sec=>(
        <div key={sec.title} style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8,paddingBottom:4,borderBottom:"1px solid #e2e8f0"}}>{sec.title}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {sec.keys.map(k=>{
              const f=fieldMap[k]; if(!f) return null;
              const isWide = f.type==="textarea" || k==="notes" || k==="licensekey" || k==="purchaseinfo";
              const val = formatVal(k, d[k]);
              return (
                <div key={k} style={{gridColumn:isWide?"1 / -1":"auto"}}>
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:3}}>{f.label}</div>
                  <div style={{padding:"8px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,background:"#f8fafc",wordBreak:"break-all"}}>{val}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        {onRestore && <Btn onClick={onRestore} variant="warning" style={{flex:1,padding:12}}>🔄 복구하기</Btn>}
        {onDelete  && <Btn onClick={onDelete}  variant="danger"  style={{flex:1,padding:12}}>🗑️ 영구삭제</Btn>}
      </div>
    </div>
  );
}

// ================================================================
// 📋 [변경내용 뷰] JSON 코드값 → 사람이 읽기 좋은 형태로 변환
// ================================================================
function ChangeDetailView({ item }) {
  // JSON 문자열 → 객체로 파싱
  const parse = (val) => {
    if (!val) return null;
    try { return JSON.parse(val); } catch { return null; }
  };

  const before = parse(item.before);
  const after  = parse(item.after);

  // key → 한국어 라벨 매핑 (장비+소프트웨어+사용자 통합)
  const LABEL_MAP = {
    // 장비
    num:"번호", assetstatus:"자산상태", clinic:"지점", inspectiondate:"실사날짜",
    gccode:"GC자산코드", imedcode:"아이메드코드", serialnumber:"제조번호",
    ip:"IP", team:"팀(부서명)", username:"사용자", pcname:"PC이름",
    modelname:"모델명", assettype:"자산구분", notes:"비고",
    macaddress:"MAC Address", receiptdate:"수령일", purchasedate:"구입일",
    manufacturer:"제조사", cpu:"CPU", memory:"Memory", hdd:"하드디스크",
    purpose:"목적/기능", corporation:"법인", location:"위치",
    purchaseinfo:"구매정보", monitorcount:"모니터수량", paidlicense:"유료라이선스",
    // 소프트웨어
    name:"소프트웨어명", category:"카테고리", version:"버전", vendor:"벤더",
    licensetype:"라이선스유형", licensekey:"라이선스키", quantity:"수량",
    cost:"비용", expirydate:"만료일", assignedto:"담당자", status:"상태",
    // 사용자
    loginid:"아이디", dept:"부서", role:"권한",
    // 공통
    created_at:"등록일", id:"ID",
  };

  // 값 → 표시용 텍스트 변환
  const displayVal = (k, v) => {
    if (v === null || v === undefined || v === "") return "-";
    if (k === "assetstatus") return ASSET_STATUS[v] || v;
    if (k === "assettype")   return ASSET_TYPES[v]  || v;
    if (k === "clinic")      return CLINICS[v]       || v;
    if (k === "status")      return SW_STATUS[v]     || ASSET_STATUS[v] || v;
    if (k === "category")    return SW_CATEGORIES[v] || v;
    if (k === "role")        return ROLES[v]         || v;
    return String(v);
  };

  // 두 객체의 모든 키를 합쳐서 비교
  const allKeys = [...new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after  || {}),
  ])].filter(k => !["id","created_at"].includes(k));

  // 변경된 키만 필터
  const changedKeys = allKeys.filter(k => {
    const bv = displayVal(k, before?.[k]);
    const av = displayVal(k, after?.[k]);
    return bv !== av;
  });

  // 변경된 것이 없으면 전체 표시
  const keysToShow = changedKeys.length > 0 ? changedKeys : allKeys;

  // 단순 텍스트인 경우 (before/after가 JSON이 아님)
  if (!before && !after) {
    return (
      <div style={{padding:"16px",color:"#64748b",fontSize:13}}>
        변경 내용이 없거나 JSON 형식이 아닙니다.
      </div>
    );
  }

  return (
    <div style={{maxHeight:"65vh",overflowY:"auto"}}>
      {changedKeys.length > 0 && (
        <div style={{background:"#fef3c7",borderRadius:10,padding:"8px 14px",marginBottom:12,fontSize:12,color:"#d97706",fontWeight:600}}>
          ⚡ {changedKeys.length}개 항목이 변경되었습니다
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:"0"}}>
        {/* 헤더 */}
        <div style={{padding:"8px 12px",background:"#f8fafc",fontWeight:700,fontSize:11,color:"#94a3b8",borderBottom:"1px solid #e2e8f0"}}>항목</div>
        <div style={{padding:"8px 12px",background:"#fff1f0",fontWeight:700,fontSize:11,color:"#cf1322",borderBottom:"1px solid #e2e8f0"}}>변경 전</div>
        <div style={{padding:"8px 12px",background:"#e8f5e9",fontWeight:700,fontSize:11,color:"#0f6e56",borderBottom:"1px solid #e2e8f0"}}>변경 후</div>
        {/* 데이터 행 */}
        {keysToShow.map((k,i) => {
          const bv = displayVal(k, before?.[k]);
          const av = displayVal(k, after?.[k]);
          const isChanged = bv !== av;
          const bg = i%2===0 ? "#fff" : "#f8fafc";
          return [
            <div key={k+"-label"} style={{padding:"7px 12px",background:bg,fontSize:12,fontWeight:isChanged?700:400,color:isChanged?"#334155":"#64748b",borderBottom:"1px solid #f0f0f0",whiteSpace:"nowrap"}}>
              {LABEL_MAP[k] || k}
            </div>,
            <div key={k+"-before"} style={{padding:"7px 12px",background:isChanged?"#fff8f8":bg,fontSize:12,color:isChanged?"#cf1322":"#64748b",borderBottom:"1px solid #f0f0f0",wordBreak:"break-all"}}>
              {bv === "-" ? <span style={{color:"#d1d5db"}}>-</span> : bv}
            </div>,
            <div key={k+"-after"} style={{padding:"7px 12px",background:isChanged?"#f0fdf4":bg,fontSize:12,color:isChanged?"#0f6e56":"#64748b",borderBottom:"1px solid #f0f0f0",wordBreak:"break-all",fontWeight:isChanged?600:400}}>
              {av === "-" ? <span style={{color:"#d1d5db"}}>-</span> : av}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}

// ================================================================
// 🔑 [로그인]
// ================================================================
function LoginPage({ onLogin }) {
  const [id,      setId]      = useState("");
  const [pw,      setPw]      = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  // 엔터키 로그인 지원
  const handleKeyDown = (e) => { if (e.key === "Enter") submit(e); };

  const submit = async (e) => {
    e.preventDefault();
    if (!id.trim() || !pw.trim()) { setErrMsg("아이디와 비밀번호를 모두 입력하세요."); return; }
    setLoading(true);
    setErrMsg("");
    try {
      // DB에서 직접 해당 아이디/패스워드 조회 — users prop에 의존하지 않음
      const res = await fetch(
        `${BASE_URL}/users?loginid=eq.${encodeURIComponent(id.trim())}&password=eq.${encodeURIComponent(pw.trim())}&select=*`,
        { headers: H }
      );
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const list = await res.json();
      if (!Array.isArray(list) || list.length === 0) {
        setErrMsg("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      await onLogin(list[0]);
    } catch (err) {
      setErrMsg("로그인 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#f0fdf4 0%,#f1f5f9 100%)"}}>
      <form onSubmit={submit} style={{width:360,background:"#fff",padding:"44px 40px",borderRadius:24,boxShadow:"0 8px 40px rgba(0,0,0,0.10)"}}>
        {/* 로고 영역 */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,borderRadius:16,background:"#e8f5e9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 12px"}}>🖥️</div>
          <h1 style={{color:"#0f6e56",margin:"0 0 4px",fontSize:22,fontWeight:800}}>IT Asset Manager</h1>
          <p style={{color:"#94a3b8",margin:0,fontSize:12}}>GC녹십자아이메드 IT자산관리</p>
        </div>

        {/* 오류 메시지 */}
        {errMsg && (
          <div style={{background:"#fff1f0",border:"1px solid #ffa39e",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#cf1322",display:"flex",gap:8,alignItems:"center"}}>
            <span>⚠️</span>{errMsg}
          </div>
        )}

        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:5,fontWeight:600}}>아이디</div>
          <input
            placeholder="아이디를 입력하세요"
            value={id}
            onChange={e=>{setId(e.target.value);setErrMsg("");}}
            onKeyDown={handleKeyDown}
            required
            disabled={loading}
            autoFocus
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box",outline:"none",transition:"border-color 0.2s"}}
            onFocus={e=>e.target.style.borderColor="#0f6e56"}
            onBlur={e=>e.target.style.borderColor="#e2e8f0"}
          />
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:5,fontWeight:600}}>비밀번호</div>
          <input
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={pw}
            onChange={e=>{setPw(e.target.value);setErrMsg("");}}
            onKeyDown={handleKeyDown}
            required
            disabled={loading}
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box",outline:"none",transition:"border-color 0.2s"}}
            onFocus={e=>e.target.style.borderColor="#0f6e56"}
            onBlur={e=>e.target.style.borderColor="#e2e8f0"}
          />
        </div>
        <Btn type="submit" variant="primary" disabled={loading} style={{width:"100%",padding:14,fontSize:15,borderRadius:12}}>
          {loading ? (
            <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>
              로그인 중...
            </span>
          ) : "로그인"}
        </Btn>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </form>
    </div>
  );
}

// ================================================================
// 🔘 공통 컴포넌트
// ================================================================
function Btn({onClick,variant="default",children,style={},disabled=false,type="button"}){
  const S={default:{background:"#fff",color:"#333",border:"1px solid #ddd"},primary:{background:"#0f6e56",color:"#fff",border:"none"},danger:{background:"#fff1f0",color:"#cf1322",border:"1px solid #ffa39e"},warning:{background:"#fffbe6",color:"#d48806",border:"1px solid #ffe58f"}};
  return <button type={type} onClick={onClick} disabled={disabled} style={{padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.6:1,...S[variant],...style}}>{children}</button>;
}
function Modal({title,onClose,children}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:580,padding:24,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{margin:0,fontSize:17}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94a3b8"}}>✕</button>
        </div>
        <div style={{overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
}
function ResizeHandle({ onResize, onDoubleClick }) {
  const startRef = useRef(null);
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX };
    const onMove = (mv) => {
      if (!startRef.current) return;
      const delta = mv.clientX - startRef.current.x;
      startRef.current.x = mv.clientX;
      onResize(delta);
    };
    const onUp = () => {
      startRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={(e)=>{ e.stopPropagation(); onDoubleClick && onDoubleClick(); }}
      style={{position:"absolute",right:0,top:0,bottom:0,width:6,cursor:"col-resize",zIndex:10,
        background:"transparent",borderRight:"2px solid transparent",transition:"border-color 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderRightColor="#0f6e56"}
      onMouseLeave={e=>e.currentTarget.style.borderRightColor="transparent"}
    />
  );
}
// ── 가상 스크롤 상수
const VIRT_ROW_H = 40;
const VIRT_OVERSCAN = 8;
const VIRT_THRESHOLD = 200; // 이 행 수 이상일 때 가상 스크롤 적용

function ResponsiveTable({cols, rows, empty="데이터가 없습니다.", onRowDoubleClick}){
  const calcW = (c) => {
    if(c.minWidth) return c.minWidth;
    const lbl = typeof c.label==="function" ? "" : (c.label||"");
    return Math.max(80, lbl.length * 16 + 32);
  };
  const [colWidths,   setColWidths]   = useState(() => cols.map(calcW));
  const [selectedRow, setSelectedRow] = useState(null);
  const [sortKey,     setSortKey]     = useState(null);
  const [sortDir,     setSortDir]     = useState("asc");
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const [scrollTop,   setScrollTop]   = useState(0);

  // ── refs
  // outerRef: 헤더+바디를 감싸는 공통 컨테이너 (가로 스크롤 소스)
  const outerRef  = useRef(null);
  // bodyRef:  바디 전용 스크롤 컨테이너 (세로 스크롤)
  const bodyRef   = useRef(null);
  const ctxRef    = useRef(null);
  const thumbRef  = useRef(null);
  const trackRef  = useRef(null);
  const headerRef = useRef(null); // 헤더 table 감싸는 div

  const useVirtual = rows.length >= VIRT_THRESHOLD;

  useEffect(() => {
    setColWidths(prev => prev.length !== cols.length ? cols.map(calcW) : prev);
  }, [cols.length]);

  useEffect(() => {
    const h = (e) => { if(ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // 정렬
  const sortedRows = useMemo(() => {
    if(sortKey === null) return rows;
    const col = cols[sortKey];
    if(!col || col.noClip === true) return rows;
    const getVal = col.sortVal
      ? (row) => { try { const v = col.sortVal(row); return v == null ? "" : String(v).toLowerCase(); } catch { return ""; } }
      : col.key ? (row) => (row[col.key] ?? "").toString().toLowerCase() : null;
    if(!getVal) return rows;
    return [...rows].sort((a, b) => {
      const av = getVal(a), bv = getVal(b);
      const n1 = parseFloat(av), n2 = parseFloat(bv);
      if(!isNaN(n1) && !isNaN(n2)) return sortDir==="asc" ? n1-n2 : n2-n1;
      return sortDir==="asc" ? av.localeCompare(bv,"ko") : bv.localeCompare(av,"ko");
    });
  }, [rows, sortKey, sortDir, cols]);

  // 가상 스크롤 범위
  const totalHeight   = sortedRows.length * VIRT_ROW_H;
  const startIdx      = useVirtual ? Math.max(0, Math.floor(scrollTop / VIRT_ROW_H) - VIRT_OVERSCAN) : 0;
  const endIdx        = useVirtual ? Math.min(sortedRows.length, Math.ceil((scrollTop + 600) / VIRT_ROW_H) + VIRT_OVERSCAN) : sortedRows.length;
  const visibleRows   = sortedRows.slice(startIdx, endIdx);
  const paddingTop    = startIdx * VIRT_ROW_H;
  const paddingBottom = (sortedRows.length - endIdx) * VIRT_ROW_H;

  const totalWidth = colWidths.reduce((a,b)=>a+b,0);

  // ── 커스텀 가로 스크롤바 동기화
  // outerRef(가로 스크롤 소스)와 커스텀 스크롤바 thumb을 동기화
  const syncThumb = useCallback(() => {
    const el = outerRef.current; const tr = trackRef.current; const th = thumbRef.current;
    if(!el||!tr||!th) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const thumbW = Math.max(40, tr.clientWidth * ratio);
    const maxScroll = el.scrollWidth - el.clientWidth;
    const maxThumb  = tr.clientWidth - thumbW;
    th.style.width = thumbW + "px";
    th.style.left  = (maxScroll > 0 ? (el.scrollLeft / maxScroll) * maxThumb : 0) + "px";
    tr.style.display = ratio >= 1 ? "none" : "block";
  }, []);

  // outerRef 가로 스크롤 → 헤더도 함께 이동
  const handleOuterScroll = useCallback(() => {
    syncThumb();
    // 헤더와 바디의 scrollLeft를 항상 outerRef와 동기화
    if(headerRef.current) headerRef.current.scrollLeft = outerRef.current?.scrollLeft ?? 0;
    if(bodyRef.current)   bodyRef.current.scrollLeft   = outerRef.current?.scrollLeft ?? 0;
  }, [syncThumb]);

  useEffect(() => {
    const el = outerRef.current;
    if(!el) return;
    syncThumb();
    el.addEventListener("scroll", handleOuterScroll);
    const ro = new ResizeObserver(syncThumb);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", handleOuterScroll); ro.disconnect(); };
  }, [totalWidth, syncThumb, handleOuterScroll]);

  const startThumbDrag = (e) => {
    e.preventDefault();
    const el = outerRef.current; const tr = trackRef.current; const th = thumbRef.current;
    if(!el||!tr||!th) return;
    const startX = e.clientX, startLeft = el.scrollLeft;
    const trackW = tr.clientWidth, thumbW = th.offsetWidth;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const onMove = (mv) => {
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startLeft + (mv.clientX-startX)/(trackW-thumbW)*maxScroll));
    };
    const onUp = () => { window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
    window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
  };

  // 바디 세로 스크롤 → 가상 스크롤 업데이트 + 가로는 outerRef로 전달
  const handleBodyScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
    // 바디의 가로 스크롤을 outerRef에 동기화 (바디는 overflow-x:hidden이므로 실질적으론 0)
  }, []);

  const handleColHeaderClick = (i) => {
    const col = cols[i];
    if(!col || typeof col.label === "function" || col.noClip) return;
    if(!col.key && !col.sortVal) return;
    if(sortKey === i) setSortDir(d => d==="asc" ? "desc" : "asc");
    else { setSortKey(i); setSortDir("asc"); }
    setCtxMenu(null);
  };

  const handleColHeaderRightClick = (e, i) => {
    const col = cols[i];
    if(!col || typeof col.label === "function" || col.noClip) return;
    if(!col.key && !col.sortVal) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, colIdx: i });
  };

  const autoFitCol = (i) => {
    const col = cols[i];
    if(!col) return;
    const lbl = typeof col.label === "function" ? "" : (col.label || "");
    const labelW = [...lbl].reduce((a,ch)=>a+(ch.charCodeAt(0)>127?14:8),0) + 52;
    let maxContentW = labelW;
    if(col.key) {
      rows.slice(0, 200).forEach(row => {
        const val = String(row[col.key] ?? "");
        const w = [...val].reduce((a,ch)=>a+(ch.charCodeAt(0)>127?14:8),0) + 32;
        if(w > maxContentW) maxContentW = w;
      });
    }
    setColWidths(prev => { const next=[...prev]; next[i]=Math.min(Math.max(maxContentW,60),500); return next; });
  };

  const handleResize = (i, delta) => {
    setColWidths(prev => { const next=[...prev]; next[i]=Math.max(50,next[i]+delta); return next; });
  };

  const rowBg = (ri, isSelected) => isSelected ? "#d1fae5" : (ri%2===0 ? "#ffffff" : "#f8fafc");
  const sortIndicator = (i) => {
    const col = cols[i];
    if(!col || col.noClip || (!col.key && !col.sortVal)) return null;
    if(sortKey !== i) return <span style={{color:"#d1d5db",fontSize:9,marginLeft:3}}>⇅</span>;
    return <span style={{color:"#0f6e56",fontSize:9,marginLeft:3}}>{sortDir==="asc"?"▲":"▼"}</span>;
  };

  // ── 공통 colgroup
  const Colgroup = () => <colgroup>{colWidths.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>;

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #eee",display:"flex",flexDirection:"column",position:"relative"}}>

      {/*
        ┌─────────────────────────────────────────────┐
        │  outerRef: 가로 스크롤 마스터 (스크롤바 숨김) │
        │  ┌─────────────────────────────────────────┐ │
        │  │ headerRef: 헤더 (overflow:hidden, 좌우이동)│ │
        │  └─────────────────────────────────────────┘ │
        │  ┌─────────────────────────────────────────┐ │
        │  │ bodyRef:  바디 (overflow-y:auto → 세로)  │ │
        │  └─────────────────────────────────────────┘ │
        └─────────────────────────────────────────────┘
        커스텀 가로 스크롤바 (outerRef 기반, 하나만)
      */}

      {/* ── 가로 스크롤 마스터 컨테이너 (스크롤바 숨김) */}
      <div ref={outerRef}
        onScroll={handleOuterScroll}
        style={{overflowX:"auto", overflowY:"hidden", scrollbarWidth:"none", msOverflowStyle:"none"}}>
        <style>{`
          .rt-outer::-webkit-scrollbar { display:none; }
          .rt-body::-webkit-scrollbar { width:8px; }
          .rt-body::-webkit-scrollbar-track { background:#f1f5f9; }
          .rt-body::-webkit-scrollbar-thumb { background:#94a3b8; border-radius:4px; }
          .rt-body::-webkit-scrollbar-thumb:hover { background:#64748b; }
        `}</style>

        {/* ── 헤더: 가로 스크롤 따라 움직임, 세로 고정 */}
        <div ref={headerRef} style={{overflowX:"hidden", overflowY:"hidden", width:totalWidth}}>
          <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:totalWidth,minWidth:totalWidth}}>
            <Colgroup/>
            <thead>
              <tr style={{background:"linear-gradient(180deg,#f1f5f9 0%,#e8eef4 100%)"}}>
                {cols.map((c,i)=>{
                  const isSortable = typeof c.label !== "function" && !c.noClip;
                  return (
                    <th key={i}
                      onClick={()=>handleColHeaderClick(i)}
                      onContextMenu={(e)=>handleColHeaderRightClick(e,i)}
                      style={{padding:i===0?"10px 4px":"12px 12px",textAlign:i===0?"center":"left",
                        fontSize:11,color:"#475569",borderBottom:"2px solid #e2e8f0",
                        borderRight:"1px solid #e8eef4",whiteSpace:"nowrap",fontWeight:700,
                        position:"relative",userSelect:"none",overflow:"visible",
                        boxSizing:"border-box",cursor:isSortable?"pointer":"default"}}>
                      <span style={{display:"flex",alignItems:"center",gap:2,overflow:"hidden",paddingRight:i===0?0:8}}>
                        <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{typeof c.label==="function"?c.label():c.label}</span>
                        {isSortable && sortIndicator(i)}
                      </span>
                      <ResizeHandle onResize={delta=>handleResize(i,delta)} onDoubleClick={()=>autoFitCol(i)}/>
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        </div>

        {/* ── 바디: 세로 스크롤 (우측 스크롤바 표시) + 가로는 outerRef 따라감 */}
        <div ref={bodyRef}
          className="rt-body"
          onScroll={handleBodyScroll}
          style={{
            overflowX:"hidden",  // 가로는 outerRef가 담당
            overflowY:"auto",    // 세로 스크롤바 항상 표시
            maxHeight: useVirtual ? 600 : 70*Math.min(sortedRows.length, 20) + 10,
            width: totalWidth,
          }}>
          {sortedRows.length === 0
            ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",width:totalWidth}}>{empty}</div>
            : (
              <>
                {useVirtual && <div style={{height:paddingTop}}/>}
                <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:totalWidth,minWidth:totalWidth}}>
                  <Colgroup/>
                  <tbody>
                    {visibleRows.map((row, vi) => {
                      const ri = startIdx + vi;
                      const isSelected = selectedRow === ri;
                      return (
                        <tr key={ri}
                          style={{
                            borderBottom:"1px solid #f0f4f8",
                            background: rowBg(ri, isSelected),
                            cursor: onRowDoubleClick ? "pointer" : "default",
                            height: VIRT_ROW_H,
                          }}
                          onClick={()=>setSelectedRow(isSelected?null:ri)}
                          onDoubleClick={()=>onRowDoubleClick && onRowDoubleClick(row)}
                          onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="#eff6ff"; }}
                          onMouseLeave={e=>{ e.currentTarget.style.background=rowBg(ri,isSelected); }}>
                          {cols.map((c,ci)=>(
                            <td key={ci} style={{
                              padding:ci===0?"9px 4px":"11px 12px",fontSize:13,
                              textAlign:ci===0?"center":"left",
                              overflow:c.noClip?"visible":"hidden",
                              textOverflow:c.noClip?"unset":"ellipsis",
                              whiteSpace:c.noClip?"normal":"nowrap",
                              borderRight:"1px solid #f0f4f8",
                              boxSizing:"border-box",
                              height:VIRT_ROW_H,
                            }}>
                              {c.render?c.render(row,ri,sortedRows):row[c.key]}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {useVirtual && <div style={{height:paddingBottom}}/>}
              </>
            )
          }
        </div>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div ref={ctxRef} style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,background:"#fff",border:"1px solid #e2e8f0",
          borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.14)",zIndex:9999,minWidth:160,overflow:"hidden"}}>
          <div style={{padding:"8px 14px",fontSize:11,color:"#94a3b8",borderBottom:"1px solid #f0f0f0",fontWeight:600}}>
            {typeof cols[ctxMenu.colIdx]?.label === "string" ? cols[ctxMenu.colIdx].label : "정렬"} 정렬
          </div>
          {[{label:"▲ 오름차순 (A→Z)",dir:"asc"},{label:"▼ 내림차순 (Z→A)",dir:"desc"}].map(opt=>(
            <div key={opt.dir} onClick={()=>{ setSortKey(ctxMenu.colIdx); setSortDir(opt.dir); setCtxMenu(null); }}
              style={{padding:"10px 16px",fontSize:13,cursor:"pointer",
                background:sortKey===ctxMenu.colIdx&&sortDir===opt.dir?"#e8f5e9":"transparent",
                color:sortKey===ctxMenu.colIdx&&sortDir===opt.dir?"#0f6e56":"#334155",
                fontWeight:sortKey===ctxMenu.colIdx&&sortDir===opt.dir?700:400}}
              onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={e=>e.currentTarget.style.background=sortKey===ctxMenu.colIdx&&sortDir===opt.dir?"#e8f5e9":"transparent"}>
              {opt.label}
            </div>
          ))}
          <div onClick={()=>{ setSortKey(null); setCtxMenu(null); }}
            style={{padding:"10px 16px",fontSize:13,cursor:"pointer",color:"#94a3b8",borderTop:"1px solid #f0f0f0"}}
            onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>✕ 정렬 해제</div>
          <div onClick={()=>{ autoFitCol(ctxMenu.colIdx); setCtxMenu(null); }}
            style={{padding:"10px 16px",fontSize:13,cursor:"pointer",color:"#334155",borderTop:"1px solid #f0f0f0"}}
            onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>↔ 너비 자동 맞춤</div>
        </div>
      )}

      {/* ── 커스텀 가로 스크롤바 (outerRef 기반, 하나만) */}
      <div ref={trackRef}
        style={{height:12,background:"#f1f5f9",borderTop:"1px solid #e2e8f0",
          borderRadius:"0 0 14px 14px",cursor:"pointer",position:"relative"}}
        onClick={e=>{
          const el=outerRef.current; const tr=trackRef.current; const th=thumbRef.current;
          if(!el||!tr||!th) return;
          const rect=tr.getBoundingClientRect();
          el.scrollLeft=(el.scrollWidth-el.clientWidth)*((e.clientX-rect.left)/tr.clientWidth);
        }}>
        <div ref={thumbRef} onMouseDown={startThumbDrag}
          style={{position:"absolute",top:2,height:8,background:"#94a3b8",borderRadius:4,cursor:"grab",minWidth:40}}
          onMouseEnter={e=>e.currentTarget.style.background="#64748b"}
          onMouseLeave={e=>e.currentTarget.style.background="#94a3b8"}/>
      </div>
    </div>
  );
}
