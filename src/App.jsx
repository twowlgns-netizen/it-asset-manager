import { useState, useEffect, useRef, useCallback } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
const nowISO = () => new Date().toISOString();
const fDate = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "-";
const fDateTime = (d) => d ? new Date(d).toLocaleString("ko-KR") : "-";
const fMoney = (n) => n ? `₩${Number(n).toLocaleString()}원` : "-";
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24)) : null;

const HW_TYPES = { desktop: "데스크탑", monitor: "모니터", laptop: "노트북" };
const HW_STATUS = { active: "사용중", inactive: "미사용", repair: "수리중", disposed: "폐기" };
const LIC_TYPES = { "per-seat": "사용자별 라이선스", site: "사이트 라이선스", concurrent: "동시 사용" };

const INIT_USERS = [
  { id: "u1", name: "김철수", dept: "개발팀", email: "kim@company.com", position: "선임개발자", createdAt: nowISO() },
  { id: "u2", name: "이영희", dept: "디자인팀", email: "lee@company.com", position: "UI/UX 디자이너", createdAt: nowISO() },
  { id: "u3", name: "박민준", dept: "인사팀", email: "park@company.com", position: "HR 담당자", createdAt: nowISO() },
  { id: "u4", name: "최지원", dept: "영업팀", email: "choi@company.com", position: "영업 매니저", createdAt: nowISO() },
];

const INIT_HW = [
  { id: "h1", type: "laptop", name: "MacBook Pro 14인치", brand: "Apple", model: "MBP2023", serial: "SN-AP-001", status: "active", assignedTo: "u1", purchaseDate: "2023-01-15", warrantyEnd: "2026-01-15", cost: 2800000, notes: "개발용 고사양 노트북", createdAt: nowISO() },
  { id: "h2", type: "monitor", name: "Dell U2722D 27인치", brand: "Dell", model: "U2722D", serial: "SN-DL-002", status: "active", assignedTo: "u1", purchaseDate: "2023-01-15", warrantyEnd: "2025-06-15", cost: 650000, notes: "4K UHD 모니터", createdAt: nowISO() },
  { id: "h3", type: "desktop", name: "iMac 24인치", brand: "Apple", model: "iMac2022", serial: "SN-AP-003", status: "active", assignedTo: "u2", purchaseDate: "2022-06-01", warrantyEnd: "2025-06-01", cost: 2200000, notes: "디자인 작업용", createdAt: nowISO() },
];

const INIT_LIC = [
  { id: "l1", name: "Microsoft 365", vendor: "Microsoft", licenseType: "per-seat", totalSeats: 10, assignedTo: ["u1","u2"], purchaseDate: "2024-01-01", expiryDate: "2025-01-01", cost: 180000, status: "active", notes: "전사 오피스", createdAt: nowISO() },
  { id: "l2", name: "Adobe Creative Cloud", vendor: "Adobe", licenseType: "per-seat", totalSeats: 3, assignedTo: ["u2"], purchaseDate: "2024-03-01", expiryDate: "2025-03-01", cost: 72000, status: "active", notes: "디자인팀", createdAt: nowISO() },
];

const INIT_HIST = [
  { id: "his1", ts: new Date(Date.now()-86400000*3).toISOString(), action: "자산 등록", aType: "hardware", aId: "h1", aName: "MacBook Pro", uId: "u1", uName: "김철수", detail: "신규 노트북 등록" },
];

function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }} onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#fff", borderRadius:12, width:"100%", maxWidth:width, maxHeight:"90vh", overflow:"auto", boxShadow:"0 10px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #e0e0e0", position:"sticky", top:0, background:"#fff" }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:600 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>✕</button>
        </div>
        <div style={{ padding:"20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Btn({ onClick, variant="default", children, style={}, disabled=false }) {
  const styles = {
    default: { background:"#f5f5f5", color:"#333", border:"1px solid #ddd" },
    primary: { background:"#0f6e56", color:"#fff", border:"none" },
    danger: { background:"#ffebee", color:"#c62828", border:"1px solid #ffcdd2" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ padding:"8px 14px", borderRadius:6, fontSize:12, fontWeight:500, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, ...styles[variant], ...style }}>{children}</button>;
}

function Table({ cols, rows, empty="데이터 없음" }) {
  return (
    <div style={{ border:"1px solid #e0e0e0", borderRadius:8, overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#f5f5f5" }}>
            {cols.map((c,i) => (
              <th key={i} style={{ padding:"12px", textAlign:"left", fontWeight:600, borderBottom:"1px solid #e0e0e0", fontSize:12 }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding:20, textAlign:"center", color:"#999" }}>{empty}</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom:"1px solid #e0e0e0" }} onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {cols.map((c,ci) => (
                <td key={ci} style={{ padding:"12px", verticalAlign:"middle" }}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportToCSV(data, filename) {
  if (!data || data.length === 0) { alert("데이터가 없습니다."); return; }
  const headers = Object.keys(data[0]);
  const csv = [headers.join(","), ...data.map(row => headers.map(h => {
    const val = row[h];
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val).replace(/"/g, '""');
    return String(val).includes(",") ? `"${String(val).replace(/"/g, '""')}"` : val;
  }).join(","))].join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===================== HARDWARE PAGE =====================
function HardwarePage({ hardware, users, setHardware, addHistory }) {
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState({ type:"", status:"", search:"" });
  const [form, setForm] = useState({});

  const filtered = hardware.filter(h => {
    if (filter.type && h.type !== filter.type) return false;
    if (filter.status && h.status !== filter.status) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return h.name.toLowerCase().includes(q) || h.serial?.toLowerCase().includes(q);
    }
    return true;
  });

  const save = () => {
    if (!form.name?.trim()) return alert("자산명 입력필수");
    if (modal === "add") {
      const newHw = { ...form, id: genId(), createdAt: nowISO() };
      setHardware(prev => [newHw, ...prev]);
      addHistory("자산 등록", "hardware", newHw.id, newHw.name, form.assignedTo, "신규 자산 등록");
    } else {
      setHardware(prev => prev.map(h => h.id===form.id ? form : h));
      addHistory("자산 수정", "hardware", form.id, form.name, null, "자산 정보 수정");
    }
    setModal(null);
  };

  const cols = [
    { label:"자산명", render: h => <span><strong>{h.name}</strong></span> },
    { label:"유형", render: h => HW_TYPES[h.type] || h.type },
    { label:"브랜드", render: h => h.brand },
    { label:"상태", render: h => <span style={{ padding:"2px 8px", background:h.status==="active"?"#e8f5e9":"#f5f5f5", borderRadius:4, fontSize:11 }}>{HW_STATUS[h.status]}</span> },
    { label:"사용자", render: h => { const u = users.find(x=>x.id===h.assignedTo); return u ? u.name : "미배정"; } },
    { label:"비용", render: h => fMoney(h.cost) },
    { label:"", render: h => (
      <div style={{ display:"flex", gap:4 }}>
        <Btn onClick={()=>{setForm(h); setModal("edit");}} variant="default" style={{fontSize:11}}>수정</Btn>
        <Btn onClick={()=>{setHardware(p=>p.filter(x=>x.id!==h.id)); addHistory("자산 삭제", "hardware", h.id, h.name, null, "삭제됨");}} variant="danger" style={{fontSize:11}}>삭제</Btn>
      </div>
    )},
  ];

  return (
    <div style={{ padding:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0 }}>하드웨어 관리</h2>
        <div style={{display:"flex", gap:8}}>
          <Btn onClick={()=>exportToCSV(filtered, "하드웨어")} variant="default">CSV</Btn>
          <Btn onClick={()=>{setForm({status:"active"}); setModal("add");}} variant="primary">+ 등록</Btn>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input placeholder="검색" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, padding:"8px", border:"1px solid #ddd", borderRadius:6 }} />
        <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ padding:"8px", border:"1px solid #ddd", borderRadius:6 }}>
          <option value="">전체 유형</option>
          {Object.entries(HW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))} style={{ padding:"8px", border:"1px solid #ddd", borderRadius:6 }}>
          <option value="">전체 상태</option>
          {Object.entries(HW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Table cols={cols} rows={filtered} empty="하드웨어 없음" />

      {modal && (
        <Modal title={modal==="add"?"자산 등록":"자산 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>자산명 *</label><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>유형</label><select value={form.type||""} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}}><option value="">선택</option>{Object.entries(HW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>브랜드</label><input value={form.brand||""} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>모델</label><input value={form.model||""} onChange={e=>setForm(f=>({...f,model:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>구매비용</label><input type="number" value={form.cost||""} onChange={e=>setForm(f=>({...f,cost:Number(e.target.value)}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>상태</label><select value={form.status||"active"} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}}>{Object.entries(HW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:16}}>
            <Btn onClick={()=>setModal(null)}>취소</Btn>
            <Btn onClick={save} variant="primary">저장</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== LICENSE PAGE =====================
function LicensePage({ licenses, users, setLicenses, addHistory }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const save = () => {
    if (!form.name?.trim()) return alert("라이선스명 입력필수");
    if (modal === "add") {
      const newL = { ...form, id: genId(), assignedTo: [], createdAt: nowISO() };
      setLicenses(prev => [newL, ...prev]);
      addHistory("라이선스 등록", "license", newL.id, newL.name, null, "신규 라이선스");
    } else {
      setLicenses(prev => prev.map(l => l.id===form.id ? form : l));
      addHistory("라이선스 수정", "license", form.id, form.name, null, "수정됨");
    }
    setModal(null);
  };

  const cols = [
    { label:"소프트웨어", render: l => <strong>{l.name}</strong> },
    { label:"공급사", render: l => l.vendor },
    { label:"유형", render: l => LIC_TYPES[l.licenseType] },
    { label:"좌석", render: l => `${l.assignedTo?.length||0}/${l.totalSeats}` },
    { label:"만료일", render: l => fDate(l.expiryDate) },
    { label:"비용", render: l => fMoney(l.cost) },
    { label:"", render: l => (
      <div style={{display:"flex", gap:4}}>
        <Btn onClick={()=>{setForm(l); setModal("edit");}} variant="default" style={{fontSize:11}}>수정</Btn>
        <Btn onClick={()=>{setLicenses(p=>p.filter(x=>x.id!==l.id)); addHistory("라이선스 삭제", "license", l.id, l.name, null, "삭제됨");}} variant="danger" style={{fontSize:11}}>삭제</Btn>
      </div>
    )},
  ];

  return (
    <div style={{ padding:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0 }}>라이선스 관리</h2>
        <div style={{display:"flex", gap:8}}>
          <Btn onClick={()=>exportToCSV(licenses, "라이선스")} variant="default">CSV</Btn>
          <Btn onClick={()=>{setForm({licenseType:"per-seat", totalSeats:1, status:"active"}); setModal("add");}} variant="primary">+ 등록</Btn>
        </div>
      </div>
      <Table cols={cols} rows={licenses} empty="라이선스 없음" />

      {modal && (
        <Modal title={modal==="add"?"라이선스 등록":"라이선스 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>소프트웨어명 *</label><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>공급사</label><input value={form.vendor||""} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>좌석수</label><input type="number" value={form.totalSeats||1} onChange={e=>setForm(f=>({...f,totalSeats:Number(e.target.value)}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>비용</label><input type="number" value={form.cost||""} onChange={e=>setForm(f=>({...f,cost:Number(e.target.value)}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>구매일</label><input type="date" value={form.purchaseDate||""} onChange={e=>setForm(f=>({...f,purchaseDate:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>만료일</label><input type="date" value={form.expiryDate||""} onChange={e=>setForm(f=>({...f,expiryDate:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4}} /></div>
          </div>
          <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:16}}>
            <Btn onClick={()=>setModal(null)}>취소</Btn>
            <Btn onClick={save} variant="primary">저장</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== HISTORY PAGE =====================
function HistoryPage({ history }) {
  const [filter, setFilter] = useState({ type:"", search:"", dateRange:"all" });

  const filtered = history.filter(h => {
    if (filter.type && h.aType !== filter.type) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return h.aName?.toLowerCase().includes(q) || h.detail?.toLowerCase().includes(q);
    }
    if (filter.dateRange !== "all") {
      const now = new Date();
      const hDate = new Date(h.ts);
      const diffDays = Math.floor((now - hDate) / (1000*60*60*24));
      const range = parseInt(filter.dateRange);
      if (diffDays > range) return false;
    }
    return true;
  });

  const cols = [
    { label:"시간", render: h => <span style={{fontSize:11}}>{fDateTime(h.ts)}</span> },
    { label:"액션", render: h => h.action },
    { label:"자산", render: h => h.aName },
    { label:"유형", render: h => h.aType },
    { label:"담당자", render: h => h.uName },
  ];

  return (
    <div style={{ padding:"20px" }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ margin:"0 0 12px" }}>이력 관리</h2>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input placeholder="검색" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, padding:"8px", border:"1px solid #ddd", borderRadius:6 }} />
        <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ padding:"8px", border:"1px solid #ddd", borderRadius:6 }}>
          <option value="">전체 유형</option>
          <option value="hardware">하드웨어</option>
          <option value="license">라이선스</option>
          <option value="user">사용자</option>
        </select>
        <select value={filter.dateRange} onChange={e=>setFilter(f=>({...f,dateRange:e.target.value}))} style={{ padding:"8px", border:"1px solid #ddd", borderRadius:6 }}>
          <option value="all">전체 기간</option>
          <option value="7">최근 7일</option>
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
        </select>
        <Btn onClick={()=>exportToCSV(filtered, "로그")} variant="default">CSV</Btn>
      </div>

      <div style={{fontSize:12, color:"#666", marginBottom:8}}>총 {filtered.length}건</div>
      <Table cols={cols} rows={filtered} empty="로그 없음" />
    </div>
  );
}

// ===================== DASHBOARD =====================
function Dashboard({ stats, hardware, licenses, history, setView }) {
  return (
    <div style={{ padding:"20px" }}>
      <h2 style={{ margin:"0 0 16px" }}>대시보드</h2>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>전체 하드웨어</div>
          <div style={{fontSize:24, fontWeight:600}}>{stats.totalHw}</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>활성</div>
          <div style={{fontSize:24, fontWeight:600}}>{stats.activeHw}</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>라이선스</div>
          <div style={{fontSize:24, fontWeight:600}}>{stats.totalLic}</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>사용자</div>
          <div style={{fontSize:24, fontWeight:600}}>{stats.totalUsers}</div>
        </div>
      </div>

      <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8, marginBottom:16 }}>
        <h3 style={{ margin:"0 0 12px", fontSize:14 }}>최근 로그</h3>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {history.slice(0,5).map(h => (
            <div key={h.id} style={{display:"flex", justifyContent:"space-between", padding:8, background:"#f9f9f9", borderRadius:4, fontSize:12}}>
              <span><strong>{h.action}</strong> - {h.aName}</span>
              <span style={{color:"#999"}}>{fDateTime(h.ts)}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>setView("history")} style={{marginTop:12, color:"#0f6e56", background:"none", border:"none", cursor:"pointer", fontWeight:500}}>모두 보기 →</button>
      </div>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function App() {
  const [view, setView] = useState("dashboard");
  const [hardware, setHardware] = useState(INIT_HW);
  const [licenses, setLicenses] = useState(INIT_LIC);
  const [users, setUsers] = useState(INIT_USERS);
  const [history, setHistory] = useState(INIT_HIST);

  const addHistory = useCallback((action, aType, aId, aName, uId, detail) => {
    setHistory(prev => [{ id:genId(), ts:nowISO(), action, aType, aId, aName, uId, uName:users.find(x=>x.id===uId)?.name||"시스템", detail }, ...prev]);
  }, [users]);

  const stats = {
    totalHw: hardware.length,
    activeHw: hardware.filter(h=>h.status==="active").length,
    totalLic: licenses.length,
    totalUsers: users.length,
  };

  const nav = [
    { id:"dashboard", label:"대시보드" },
    { id:"hardware", label:"하드웨어" },
    { id:"license", label:"라이선스" },
    { id:"history", label:"로그" },
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#fff" }}>
      <div style={{ width:200, background:"#f8f8f8", borderRight:"1px solid #e0e0e0", padding:16, display:"flex", flexDirection:"column" }}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:20, color:"#0f6e56" }}>🖥️ IT 자산관리</div>
        <nav style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
          {nav.map(item => (
            <button key={item.id} onClick={()=>setView(item.id)} style={{ padding:"10px 12px", textAlign:"left", border:"none", background:view===item.id?"#e8f5e9":"transparent", color:view===item.id?"#0f6e56":"#333", borderRadius:6, cursor:"pointer", fontWeight:view===item.id?600:400 }}>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{fontSize:12, color:"#666", paddingTop:12, borderTop:"1px solid #e0e0e0"}}>
          HW {stats.totalHw} · 라이선스 {stats.totalLic} · 사용자 {stats.totalUsers}
        </div>
      </div>

      <div style={{ flex:1, background:"#fafafa" }}>
        {view==="dashboard" && <Dashboard stats={stats} hardware={hardware} licenses={licenses} history={history} setView={setView} />}
        {view==="hardware" && <HardwarePage hardware={hardware} users={users} setHardware={setHardware} addHistory={addHistory} />}
        {view==="license" && <LicensePage licenses={licenses} users={users} setLicenses={setLicenses} addHistory={addHistory} />}
        {view==="history" && <HistoryPage history={history} />}
      </div>
    </div>
  );
}
