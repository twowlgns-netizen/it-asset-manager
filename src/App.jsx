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
const STATUS_COLOR = {
  active:   { bg: "#e8f5e9", text: "#2e7d32", dot: "#43a047" },
  inactive: { bg: "#f5f5f5", text: "#757575", dot: "#9e9e9e" },
  repair:   { bg: "#fff3e0", text: "#e65100", dot: "#fb8c00" },
  disposed: { bg: "#fce4ec", text: "#c62828", dot: "#e53935" },
  expiring: { bg: "#fff8e1", text: "#f57f17", dot: "#ffa000" },
};

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
  { id: "h4", type: "laptop", name: "ThinkPad X1 Carbon", brand: "Lenovo", model: "X1C2023", serial: "SN-LN-004", status: "repair", assignedTo: null, purchaseDate: "2023-03-20", warrantyEnd: "2026-03-20", cost: 1900000, notes: "배터리 팽창으로 수리 의뢰", createdAt: nowISO() },
  { id: "h5", type: "monitor", name: "LG UltraWide 34인치", brand: "LG", model: "34WN80C", serial: "SN-LG-005", status: "inactive", assignedTo: null, purchaseDate: "2021-08-10", warrantyEnd: "2024-08-10", cost: 550000, notes: "창고 보관 중", createdAt: nowISO() },
  { id: "h6", type: "laptop", name: "Galaxy Book3 Pro", brand: "Samsung", model: "GB3P2023", serial: "SN-SS-006", status: "active", assignedTo: "u4", purchaseDate: "2023-09-01", warrantyEnd: "2026-09-01", cost: 1750000, notes: "영업팀 출장용", createdAt: nowISO() },
];
const INIT_LIC = [
  { id: "l1", name: "Microsoft 365 Business Standard", vendor: "Microsoft", licenseType: "per-seat", totalSeats: 10, assignedTo: ["u1","u2","u3","u4"], purchaseDate: "2024-01-01", expiryDate: "2025-01-01", cost: 180000, status: "active", notes: "전사 오피스 구독", createdAt: nowISO() },
  { id: "l2", name: "Adobe Creative Cloud All Apps", vendor: "Adobe", licenseType: "per-seat", totalSeats: 3, assignedTo: ["u2"], purchaseDate: "2024-03-01", expiryDate: "2025-03-01", cost: 72000, status: "active", notes: "디자인팀 전용", createdAt: nowISO() },
  { id: "l3", name: "Slack Business+", vendor: "Slack", licenseType: "per-seat", totalSeats: 20, assignedTo: ["u1","u2","u3","u4"], purchaseDate: "2024-01-01", expiryDate: "2025-01-01", cost: 120000, status: "active", notes: "전사 협업 툴", createdAt: nowISO() },
  { id: "l4", name: "Notion Team", vendor: "Notion Labs", licenseType: "per-seat", totalSeats: 15, assignedTo: ["u1","u3"], purchaseDate: "2024-06-01", expiryDate: "2025-06-01", cost: 96000, status: "active", notes: "문서·위키 관리", createdAt: nowISO() },
  { id: "l5", name: "GitHub Enterprise", vendor: "GitHub", licenseType: "per-seat", totalSeats: 5, assignedTo: ["u1"], purchaseDate: "2024-01-15", expiryDate: "2025-01-15", cost: 250000, status: "active", notes: "코드 저장소", createdAt: nowISO() },
];
const INIT_HIST = [
  { id: "his1", ts: new Date(Date.now()-86400000*3).toISOString(), action: "자산 등록", aType: "hardware", aId: "h1", aName: "MacBook Pro 14인치", uId: "u1", uName: "김철수", detail: "신규 노트북 등록 및 사용자 배정" },
  { id: "his2", ts: new Date(Date.now()-86400000*2).toISOString(), action: "라이선스 배정", aType: "license", aId: "l2", aName: "Adobe Creative Cloud", uId: "u2", uName: "이영희", detail: "Adobe CC 라이선스 신규 배정" },
  { id: "his3", ts: new Date(Date.now()-86400000).toISOString(), action: "상태 변경", aType: "hardware", aId: "h4", aName: "ThinkPad X1 Carbon", uId: null, uName: "시스템", detail: "상태 변경: 사용중 → 수리중 (배터리 팽창)" },
  { id: "his4", ts: new Date(Date.now()-3600000*4).toISOString(), action: "자산 등록", aType: "hardware", aId: "h6", aName: "Galaxy Book3 Pro", uId: "u4", uName: "최지원", detail: "영업팀 신규 노트북 등록" },
];

function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:16 }} onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--color-background-primary)", borderRadius:16, width:"100%", maxWidth:width, maxHeight:"92vh", overflow:"auto", border:"0.5px solid var(--color-border-secondary)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"0.5px solid var(--color-border-tertiary)", position:"sticky", top:0, background:"var(--color-background-primary)", zIndex:1 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:500 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"0.5px solid var(--color-border-secondary)", borderRadius:6, cursor:"pointer", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-secondary)", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:5, letterSpacing:0.3 }}>
        {label}{required && <span style={{ color:"#e53935", marginLeft:2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:3 }}>{hint}</div>}
    </div>
  );
}

function StatusBadge({ status, label }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.inactive;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:c.bg, color:c.text }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:c.dot, display:"inline-block" }} />
      {label}
    </span>
  );
}

function Section({ title, action, children }) {
  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:500 }}>{title}</h1>
        {action}
      </div>
      {children}
    </div>
  );
}

function Btn({ onClick, variant="default", children, style={}, disabled=false }) {
  const base = { display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:500, cursor:disabled?"not-allowed":"pointer", border:"0.5px solid", transition:"opacity 0.15s", opacity: disabled ? 0.5 : 1 };
  const variants = {
    default: { background:"var(--color-background-primary)", borderColor:"var(--color-border-secondary)", color:"var(--color-text-primary)" },
    primary: { background:"#0f6e56", borderColor:"#0f6e56", color:"#fff" },
    danger:  { background:"#fce4ec", borderColor:"#f48fb1", color:"#c62828" },
    ghost:   { background:"transparent", borderColor:"transparent", color:"var(--color-text-secondary)" },
  };
  return <button onClick={disabled?undefined:onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Table({ cols, rows, empty="데이터가 없습니다" }) {
  return (
    <div style={{ border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"var(--color-background-secondary)" }}>
            {cols.map((c,i) => (
              <th key={i} style={{ padding:"10px 14px", textAlign:"left", fontWeight:500, fontSize:12, color:"var(--color-text-secondary)", whiteSpace:"nowrap", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding:24, textAlign:"center", color:"var(--color-text-secondary)", fontSize:13 }}>{empty}</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom:"0.5px solid var(--color-border-tertiary)" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {cols.map((c,ci) => (
                <td key={ci} style={{ padding:"10px 14px", verticalAlign:"middle", ...c.style }}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===================== CSV/XLSX 유틸리티 =====================
function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }
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

function importFromCSV(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { alert("유효한 CSV 파일이 아닙니다."); return; }
      
      const headers = lines[0].split(",").map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const obj = {};
        const values = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === "," && !inQuotes) { values.push(current); current = ""; }
          else current += char;
        }
        values.push(current);
        headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ""; });
        return obj;
      });
      onSuccess(data);
    } catch (err) {
      alert("CSV 파일 읽기 오류: " + err.message);
    }
  };
  reader.readAsText(file);
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
      if (!h.name.toLowerCase().includes(q) && !h.serial?.toLowerCase().includes(q) && !h.brand?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openAdd = () => { setForm({ type:"laptop", status:"active", purchaseDate: new Date().toISOString().split("T")[0] }); setModal("add"); };
  const openEdit = (h) => { setForm({ ...h }); setModal("edit"); };

  const save = () => {
    if (!form.name?.trim() || !form.type) return alert("필수 항목을 입력해주세요.");
    if (modal === "add") {
      const newHw = { ...form, id: genId(), createdAt: nowISO() };
      setHardware(prev => [newHw, ...prev]);
      addHistory("자산 등록", "hardware", newHw.id, newHw.name, form.assignedTo, `신규 ${HW_TYPES[form.type]} 등록`);
    } else {
      const old = hardware.find(h=>h.id===form.id);
      setHardware(prev => prev.map(h => h.id===form.id ? { ...form } : h));
      if (old.status !== form.status) addHistory("상태 변경", "hardware", form.id, form.name, null, `상태 변경: ${HW_STATUS[old.status]} → ${HW_STATUS[form.status]}`);
      if (old.assignedTo !== form.assignedTo) {
        const u = users.find(u=>u.id===form.assignedTo);
        addHistory("사용자 배정", "hardware", form.id, form.name, form.assignedTo, `배정 변경 → ${u?.name || "미배정"}`);
      }
    }
    setModal(null);
  };

  const del = (h) => {
    if (!confirm(`'${h.name}'을(를) 휴지통으로 이동하시겠습니까?`)) return;
    setHardware(prev => prev.filter(x => x.id !== h.id));
    addHistory("자산 삭제", "hardware", h.id, h.name, null, "휴지통으로 이동");
  };

  const hwTypeIcon = { desktop:"🖥", monitor:"🖵", laptop:"💻" };

  const cols = [
    { label:"유형", render: h => <span>{hwTypeIcon[h.type]} {HW_TYPES[h.type]}</span> },
    { label:"자산명", render: h => <span style={{ fontWeight:500 }}>{h.name}</span> },
    { label:"브랜드/모델", render: h => <span style={{ color:"var(--color-text-secondary)" }}>{h.brand} {h.model}</span> },
    { label:"시리얼번호", render: h => <code style={{ fontSize:11, background:"var(--color-background-secondary)", padding:"2px 6px", borderRadius:4 }}>{h.serial || "-"}</code> },
    { label:"상태", render: h => <StatusBadge status={h.status} label={HW_STATUS[h.status]} /> },
    { label:"사용자", render: h => { const u = users.find(u=>u.id===h.assignedTo); return <span>{u ? `${u.name} (${u.dept})` : <span style={{color:"var(--color-text-secondary)"}}>미배정</span>}</span>; } },
    { label:"보증 만료", render: h => {
      const d = daysUntil(h.warrantyEnd);
      return <span style={{ color: d !== null && d < 90 && d >= 0 ? "#e65100" : "inherit" }}>{fDate(h.warrantyEnd)}</span>;
    }},
    { label:"", render: h => (
      <div style={{ display:"flex", gap:6 }}>
        <Btn onClick={()=>openEdit(h)} variant="ghost" style={{ padding:"4px 10px", fontSize:12 }}>수정</Btn>
        <Btn onClick={()=>del(h)} variant="ghost" style={{ padding:"4px 10px", fontSize:12, color:"#e53935" }}>삭제</Btn>
      </div>
    )},
  ];

  return (
    <Section title="하드웨어 관리" action={
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={()=>exportToCSV(filtered, "하드웨어")} variant="default">CSV 다운로드</Btn>
        <Btn onClick={openAdd} variant="primary">+ 자산 등록</Btn>
      </div>
    }>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {Object.entries(HW_STATUS).map(([k,v]) => (
          <div key={k} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>{v}</div>
            <div style={{ fontSize:22, fontWeight:500 }}>{hardware.filter(h=>h.status===k).length}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input placeholder="검색 (자산명, 브랜드, 시리얼)" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, minWidth:180 }} />
        <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ width:130 }}>
          <option value="">전체 유형</option>
          {Object.entries(HW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))} style={{ width:130 }}>
          <option value="">전체 상태</option>
          {Object.entries(HW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Table cols={cols} rows={filtered} empty="조건에 맞는 하드웨어가 없습니다" />

      {modal && (
        <Modal title={modal==="add"?"하드웨어 자산 등록":"하드웨어 자산 수정"} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="자산명" required><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="예: MacBook Pro 14인치" /></Field>
            <Field label="유형" required>
              <select value={form.type||""} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {Object.entries(HW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="브랜드"><input value={form.brand||""} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="예: Apple" /></Field>
            <Field label="모델명"><input value={form.model||""} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder="예: MBP2023" /></Field>
            <Field label="시리얼번호"><input value={form.serial||""} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} placeholder="예: SN-AP-001" /></Field>
            <Field label="상태">
              <select value={form.status||"active"} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {Object.entries(HW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="구매일"><input type="date" value={form.purchaseDate||""} onChange={e=>setForm(f=>({...f,purchaseDate:e.target.value}))} /></Field>
            <Field label="보증 만료일"><input type="date" value={form.warrantyEnd||""} onChange={e=>setForm(f=>({...f,warrantyEnd:e.target.value}))} /></Field>
            <Field label="구매 비용"><input type="number" value={form.cost||""} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="원 단위 입력" /></Field>
            <Field label="배정 사용자">
              <select value={form.assignedTo||""} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value||null}))}>
                <option value="">미배정</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}
              </select>
            </Field>
          </div>
          <Field label="메모/비고"><textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ width:"100%", boxSizing:"border-box" }} placeholder="특이사항이나 메모를 입력하세요" /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn onClick={()=>setModal(null)}>취소</Btn>
            <Btn onClick={save} variant="primary">{modal==="add"?"등록":"저장"}</Btn>
          </div>
        </Modal>
      )}
    </Section>
  );
}

// ===================== LICENSE PAGE =====================
function LicensePage({ licenses, users, setLicenses, addHistory }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [assignModal, setAssignModal] = useState(null);

  const openAdd = () => { setForm({ licenseType:"per-seat", totalSeats:1, status:"active", assignedTo:[], purchaseDate: new Date().toISOString().split("T")[0] }); setModal("add"); };
  const openEdit = (l) => { setForm({ ...l, assignedTo: [...(l.assignedTo||[])] }); setModal("edit"); };

  const save = () => {
    if (!form.name?.trim() || !form.vendor?.trim()) return alert("필수 항목을 입력해주세요.");
    if (modal === "add") {
      const newL = { ...form, id: genId(), assignedTo: form.assignedTo||[], createdAt: nowISO() };
      setLicenses(prev => [newL, ...prev]);
      addHistory("라이선스 등록", "license", newL.id, newL.name, null, `신규 라이선스 등록 (${newL.totalSeats}석)`);
    } else {
      setLicenses(prev => prev.map(l => l.id===form.id ? { ...form } : l));
      addHistory("라이선스 수정", "license", form.id, form.name, null, "라이선스 정보 수정");
    }
    setModal(null);
  };

  const del = (l) => {
    if (!confirm(`'${l.name}' 라이선스를 휴지통으로 이동하시겠습니까?`)) return;
    setLicenses(prev => prev.filter(x => x.id !== l.id));
    addHistory("라이선스 삭제", "license", l.id, l.name, null, "휴지통으로 이동");
  };

  const toggleUser = (licId, uid) => {
    setLicenses(prev => prev.map(l => {
      if (l.id !== licId) return l;
      const arr = l.assignedTo || [];
      const next = arr.includes(uid) ? arr.filter(x=>x!==uid) : [...arr, uid];
      const u = users.find(u=>u.id===uid);
      addHistory(arr.includes(uid)?"라이선스 회수":"라이선스 배정", "license", l.id, l.name, uid, `${u?.name} ${arr.includes(uid)?"배정 해제":"배정"}`);
      return { ...l, assignedTo: next };
    }));
  };

  const cols = [
    { label:"소프트웨어", render: l => <span style={{ fontWeight:500 }}>{l.name}</span> },
    { label:"공급사", render: l => <span style={{ color:"var(--color-text-secondary)" }}>{l.vendor}</span> },
    { label:"유형", render: l => <span style={{ fontSize:12 }}>{LIC_TYPES[l.licenseType]||l.licenseType}</span> },
    { label:"좌석 사용", render: l => {
      const used = l.assignedTo?.length||0;
      const pct = l.totalSeats ? Math.round(used/l.totalSeats*100) : 0;
      return (
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:60, height:6, background:"var(--color-background-secondary)", borderRadius:3 }}>
            <div style={{ width:`${pct}%`, height:6, background: pct>90?"#e53935":"#1d9e75", borderRadius:3 }} />
          </div>
          <span style={{ fontSize:12 }}>{used}/{l.totalSeats}</span>
        </div>
      );
    }},
    { label:"만료일", render: l => {
      const d = daysUntil(l.expiryDate);
      const warn = d !== null && d <= 30 && d >= 0;
      return <span style={{ color: warn?"#e65100":"inherit", fontWeight: warn?500:400 }}>{fDate(l.expiryDate)}{warn?` (D-${d})`:""}</span>;
    }},
    { label:"연간 비용", render: l => <span>{fMoney(l.cost)}</span> },
    { label:"", render: l => (
      <div style={{ display:"flex", gap:4 }}>
        <Btn onClick={()=>setAssignModal(l)} variant="ghost" style={{ padding:"4px 10px", fontSize:12 }}>배정 관리</Btn>
        <Btn onClick={()=>openEdit(l)} variant="ghost" style={{ padding:"4px 10px", fontSize:12 }}>수정</Btn>
        <Btn onClick={()=>del(l)} variant="ghost" style={{ padding:"4px 10px", fontSize:12, color:"#e53935" }}>삭제</Btn>
      </div>
    )},
  ];

  const totalCost = licenses.reduce((s,l)=>s+(Number(l.cost)||0),0);
  const totalSeats = licenses.reduce((s,l)=>s+(l.totalSeats||0),0);
  const usedSeats = licenses.reduce((s,l)=>s+(l.assignedTo?.length||0),0);

  return (
    <Section title="소프트웨어 라이선스" action={
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={()=>exportToCSV(licenses, "라이선스")} variant="default">CSV 다운로드</Btn>
        <Btn onClick={openAdd} variant="primary">+ 라이선스 등록</Btn>
      </div>
    }>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 16px" }}>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>전체 라이선스</div>
          <div style={{ fontSize:22, fontWeight:500 }}>{licenses.length}개</div>
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 16px" }}>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>좌석 사용률</div>
          <div style={{ fontSize:22, fontWeight:500 }}>{totalSeats?Math.round(usedSeats/totalSeats*100):0}%</div>
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 16px" }}>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>연간 총 비용</div>
          <div style={{ fontSize:18, fontWeight:500 }}>{fMoney(totalCost)}</div>
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 16px" }}>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>30일 내 만료</div>
          <div style={{ fontSize:22, fontWeight:500, color: licenses.filter(l=>{ const d=daysUntil(l.expiryDate); return d!==null&&d<=30&&d>=0; }).length>0?"#e65100":"inherit" }}>
            {licenses.filter(l=>{ const d=daysUntil(l.expiryDate); return d!==null&&d<=30&&d>=0; }).length}개
          </div>
        </div>
      </div>
      <Table cols={cols} rows={licenses} empty="등록된 라이선스가 없습니다" />

      {modal && (
        <Modal title={modal==="add"?"라이선스 등록":"라이선스 수정"} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="소프트웨어명" required><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="예: Microsoft 365" /></Field>
            <Field label="공급사" required><input value={form.vendor||""} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="예: Microsoft" /></Field>
            <Field label="라이선스 유형">
              <select value={form.licenseType||"per-seat"} onChange={e=>setForm(f=>({...f,licenseType:e.target.value}))}>
                {Object.entries(LIC_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="총 좌석 수" hint="per-seat 라이선스의 경우"><input type="number" value={form.totalSeats||""} onChange={e=>setForm(f=>({...f,totalSeats:Number(e.target.value)}))} min="1" /></Field>
            <Field label="구매일"><input type="date" value={form.purchaseDate||""} onChange={e=>setForm(f=>({...f,purchaseDate:e.target.value}))} /></Field>
            <Field label="만료일"><input type="date" value={form.expiryDate||""} onChange={e=>setForm(f=>({...f,expiryDate:e.target.value}))} /></Field>
            <Field label="연간 비용 (원)"><input type="number" value={form.cost||""} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="원 단위" /></Field>
            <Field label="상태">
              <select value={form.status||"active"} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </Field>
          </div>
          <Field label="메모"><textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ width:"100%", boxSizing:"border-box" }} /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <Btn onClick={()=>setModal(null)}>취소</Btn>
            <Btn onClick={save} variant="primary">{modal==="add"?"등록":"저장"}</Btn>
          </div>
        </Modal>
      )}

      {assignModal && (
        <Modal title={`사용자 배정 — ${assignModal.name}`} onClose={()=>setAssignModal(null)} width={440}>
          <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:14 }}>
            현재 {assignModal.assignedTo?.length||0}명 / 총 {assignModal.totalSeats}석 사용 중
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {users.map(u => {
              const lic = licenses.find(l=>l.id===assignModal.id);
              const assigned = lic?.assignedTo?.includes(u.id);
              return (
                <div key={u.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", border:"0.5px solid var(--color-border-tertiary)", borderRadius:8, background: assigned?"#e8f5e9":"var(--color-background-primary)" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{u.name}</div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{u.dept} · {u.position}</div>
                  </div>
                  <Btn onClick={()=>toggleUser(assignModal.id, u.id)} variant={assigned?"danger":"default"} style={{ padding:"5px 12px", fontSize:12 }}>
                    {assigned?"배정 해제":"배정"}
                  </Btn>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
            <Btn onClick={()=>setAssignModal(null)} variant="primary">완료</Btn>
          </div>
        </Modal>
      )}
    </Section>
  );
}

// ===================== USERS PAGE =====================
function UsersPage({ users, setUsers, hardware, licenses, addHistory }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [detail, setDetail] = useState(null);

  const openAdd = () => { setForm({}); setModal("add"); };
  const openEdit = (u) => { setForm({ ...u }); setModal("edit"); };

  const save = () => {
    if (!form.name?.trim() || !form.email?.trim()) return alert("이름과 이메일은 필수입니다.");
    if (modal === "add") {
      const newU = { ...form, id: genId(), createdAt: nowISO() };
      setUsers(prev => [newU, ...prev]);
      addHistory("사용자 등록", "user", newU.id, newU.name, newU.id, `신규 사용자 등록 (${newU.dept})`);
    } else {
      setUsers(prev => prev.map(u => u.id===form.id ? { ...form } : u));
      addHistory("사용자 수정", "user", form.id, form.name, form.id, "사용자 정보 수정");
    }
    setModal(null);
  };

  const del = (u) => {
    if (!confirm(`'${u.name}' 사용자를 휴지통으로 이동하시겠습니까? 배정된 자산은 미배정 상태로 변경됩니다.`)) return;
    setUsers(prev => prev.filter(x => x.id !== u.id));
    addHistory("사용자 삭제", "user", u.id, u.name, null, "휴지통으로 이동");
  };

  const getUserAssets = (uid) => ({
    hw: hardware.filter(h=>h.assignedTo===uid),
    lic: licenses.filter(l=>l.assignedTo?.includes(uid)),
  });

  const cols = [
    { label:"이름", render: u => (
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"#e1f5ee", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:"#0f6e56", flexShrink:0 }}>
          {u.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight:500 }}>{u.name}</div>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{u.email}</div>
        </div>
      </div>
    )},
    { label:"부서", render: u => u.dept },
    { label:"직책", render: u => u.position },
    { label:"배정 자산", render: u => {
      const { hw, lic } = getUserAssets(u.id);
      return <span style={{ fontSize:12 }}>HW {hw.length}개 · 라이선스 {lic.length}개</span>;
    }},
    { label:"등록일", render: u => <span style={{ color:"var(--color-text-secondary)", fontSize:12 }}>{fDate(u.createdAt)}</span> },
    { label:"", render: u => (
      <div style={{ display:"flex", gap:4 }}>
        <Btn onClick={()=>setDetail(u)} variant="ghost" style={{ padding:"4px 10px", fontSize:12 }}>자산 보기</Btn>
        <Btn onClick={()=>openEdit(u)} variant="ghost" style={{ padding:"4px 10px", fontSize:12 }}>수정</Btn>
        <Btn onClick={()=>del(u)} variant="ghost" style={{ padding:"4px 10px", fontSize:12, color:"#e53935" }}>삭제</Btn>
      </div>
    )},
  ];

  return (
    <Section title="사용자 관리" action={
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={()=>exportToCSV(users, "사용자")} variant="default">CSV 다운로드</Btn>
        <Btn onClick={openAdd} variant="primary">+ 사용자 등록</Btn>
      </div>
    }>
      <Table cols={cols} rows={users} empty="등록된 사용자가 없습니다" />

      {modal && (
        <Modal title={modal==="add"?"사용자 등록":"사용자 수정"} onClose={()=>setModal(null)} width={460}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="이름" required><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></Field>
            <Field label="이메일" required><input type="email" value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></Field>
            <Field label="부서"><input value={form.dept||""} onChange={e=>setForm(f=>({...f,dept:e.target.value}))} placeholder="예: 개발팀" /></Field>
            <Field label="직책"><input value={form.position||""} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="예: 선임개발자" /></Field>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Btn onClick={()=>setModal(null)}>취소</Btn>
            <Btn onClick={save} variant="primary">{modal==="add"?"등록":"저장"}</Btn>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`${detail.name}님의 배정 자산`} onClose={()=>setDetail(null)} width={500}>
          {(() => {
            const { hw, lic } = getUserAssets(detail.id);
            return (
              <div>
                <h3 style={{ fontSize:14, fontWeight:500, marginBottom:10, color:"var(--color-text-secondary)" }}>하드웨어 ({hw.length}개)</h3>
                {hw.length === 0 ? <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>배정된 하드웨어 없음</div> :
                  hw.map(h => (
                    <div key={h.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--color-background-secondary)", borderRadius:8, marginBottom:6 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{h.name}</div>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{h.serial} · {h.brand}</div>
                      </div>
                      <StatusBadge status={h.status} label={HW_STATUS[h.status]} />
                    </div>
                  ))
                }
                <h3 style={{ fontSize:14, fontWeight:500, margin:"16px 0 10px", color:"var(--color-text-secondary)" }}>소프트웨어 라이선스 ({lic.length}개)</h3>
                {lic.length === 0 ? <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>배정된 라이선스 없음</div> :
                  lic.map(l => (
                    <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--color-background-secondary)", borderRadius:8, marginBottom:6 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{l.name}</div>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{l.vendor} · 만료 {fDate(l.expiryDate)}</div>
                      </div>
                    </div>
                  ))
                }
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
                  <Btn onClick={()=>setDetail(null)} variant="primary">닫기</Btn>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </Section>
  );
}

// ===================== HISTORY & LOG PAGE =====================
function HistoryPage({ history }) {
  const [filter, setFilter] = useState({ type:"", action:"", search:"", dateRange:"all" });
  const [modal, setModal] = useState(null);
  
  const filtered = history.filter(h => {
    if (filter.type && h.aType !== filter.type) return false;
    if (filter.action && h.action !== filter.action) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!h.aName?.toLowerCase().includes(q) && !h.action?.toLowerCase().includes(q) && !h.uName?.toLowerCase().includes(q) && !h.detail?.toLowerCase().includes(q)) return false;
    }
    if (filter.dateRange !== "all") {
      const now = new Date();
      const hDate = new Date(h.ts);
      const diffDays = Math.floor((now - hDate) / (1000 * 60 * 60 * 24));
      if (filter.dateRange === "7days" && diffDays > 7) return false;
      if (filter.dateRange === "30days" && diffDays > 30) return false;
      if (filter.dateRange === "90days" && diffDays > 90) return false;
    }
    return true;
  });

  const actionColor = {
    "자산 등록": "#0f6e56", "라이선스 등록": "#0f6e56", "사용자 등록": "#0f6e56",
    "상태 변경": "#e65100", "자산 삭제": "#c62828", "라이선스 삭제": "#c62828", "사용자 삭제": "#c62828",
    "라이선스 배정": "#1565c0", "라이선스 회수": "#6a1b9a",
    "사용자 배정": "#1565c0", "자산 수정": "#555", "라이선스 수정": "#555", "사용자 수정": "#555",
  };

  const uniqueActions = [...new Set(history.map(h => h.action))];

  const cols = [
    { label:"일시", render: h => <span style={{ fontSize:12, color:"var(--color-text-secondary)", whiteSpace:"nowrap" }}>{fDateTime(h.ts)}</span> },
    { label:"액션", render: h => <span style={{ fontSize:12, fontWeight:500, color: actionColor[h.action]||"var(--color-text-primary)" }}>{h.action}</span> },
    { label:"자산", render: h => <span style={{ fontWeight:500 }}>{h.aName}</span> },
    { label:"유형", render: h => <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{ h.aType==="hardware"?"하드웨어": h.aType==="license"?"라이선스": h.aType==="user"?"사용자":h.aType }</span> },
    { label:"담당자", render: h => h.uName },
    { label:"상세 내용", render: h => <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{h.detail}</span> },
  ];

  return (
    <Section title="이력 및 로그 관리" action={
      <Btn onClick={()=>setModal("logs")} variant="primary">📊 로그 통계</Btn>
    }>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input placeholder="검색 (자산명, 액션, 담당자, 상세내용)" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, minWidth:200 }} />
        <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ width:120 }}>
          <option value="">전체 유형</option>
          <option value="hardware">하드웨어</option>
          <option value="license">라이선스</option>
          <option value="user">사용자</option>
        </select>
        <select value={filter.action} onChange={e=>setFilter(f=>({...f,action:e.target.value}))} style={{ width:140 }}>
          <option value="">전체 액션</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filter.dateRange} onChange={e=>setFilter(f=>({...f,dateRange:e.target.value}))} style={{ width:130 }}>
          <option value="all">전체 기간</option>
          <option value="7days">최근 7일</option>
          <option value="30days">최근 30일</option>
          <option value="90days">최근 90일</option>
        </select>
        <Btn onClick={()=>exportToCSV(filtered, "로그기록")} variant="default">CSV 내보내기</Btn>
      </div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:10 }}>총 {filtered.length}건 (전체 {history.length}건)</div>
      <Table cols={cols} rows={filtered} empty="로그 기록이 없습니다" />

      {modal === "logs" && (
        <Modal title="로그 통계" onClose={()=>setModal(null)} width={500}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            <div style={{ background:"var(--color-background-secondary)", padding:16, borderRadius:10 }}>
              <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>총 로그 기록</div>
              <div style={{ fontSize:28, fontWeight:500 }}>{history.length}</div>
            </div>
            <div style={{ background:"var(--color-background-secondary)", padding:16, borderRadius:10 }}>
              <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>필터된 기록</div>
              <div style={{ fontSize:28, fontWeight:500 }}>{filtered.length}</div>
            </div>
          </div>
          
          <h3 style={{ fontSize:14, fontWeight:500, marginBottom:10 }}>액션별 집계</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
            {uniqueActions.map(action => {
              const cnt = history.filter(h => h.action === action).length;
              const pct = Math.round(cnt / history.length * 100);
              return (
                <div key={action} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ width:140, fontSize:12 }}>{action}</span>
                  <div style={{ flex:1, height:6, background:"var(--color-background-tertiary)", borderRadius:3 }}>
                    <div style={{ width:`${pct}%`, height:6, background:"#0f6e56", borderRadius:3 }} />
                  </div>
                  <span style={{ width:30, textAlign:"right", fontSize:12, fontWeight:500 }}>{cnt}</span>
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize:14, fontWeight:500, marginBottom:10 }}>유형별 집계</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {["hardware", "license", "user"].map(type => {
              const cnt = history.filter(h => h.aType === type).length;
              const label = type === "hardware" ? "하드웨어" : type === "license" ? "라이선스" : "사용자";
              return (
                <div key={type} style={{ background:"var(--color-background-secondary)", padding:12, borderRadius:8, textAlign:"center" }}>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:500 }}>{cnt}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
            <Btn onClick={()=>setModal(null)} variant="primary">닫기</Btn>
          </div>
        </Modal>
      )}
    </Section>
  );
}

// ===================== TRASH PAGE =====================
function TrashPage() {
  return (
    <Section title="휴지통">
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:32, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🗑️</div>
        <div style={{ fontSize:16, fontWeight:500, marginBottom:8 }}>휴지통</div>
        <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>삭제된 자산, 라이선스, 사용자 복구 기능</div>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>현재 버전에서는 삭제된 항목이 완전히 제거됩니다.<br/>향후 버전에서 복구 기능을 추가할 예정입니다.</div>
      </div>
    </Section>
  );
}

// ===================== DASHBOARD =====================
function Dashboard({ stats, hardware, licenses, users, history, setView }) {
  const expiring = licenses.filter(l=>{ const d=daysUntil(l.expiryDate); return d!==null&&d>=0&&d<=60; });
  const repairs = hardware.filter(h=>h.status==="repair");

  return (
    <div style={{ padding:"28px 32px" }}>
      <h1 style={{ fontSize:20, fontWeight:500, marginBottom:4 }}>대시보드</h1>
      <p style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:24 }}>IT 자산 현황 요약</p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:24 }}>
        {[
          { label:"전체 하드웨어", value: stats.totalHw, sub:`활성 ${stats.activeHw}개` },
          { label:"수리/장애", value: stats.repairHw, sub:"처리 필요", warn: stats.repairHw>0 },
          { label:"소프트웨어", value: stats.totalLic+"개", sub:`좌석 ${stats.usedSeats}/${stats.totalSeats}` },
          { label:"라이선스 만료 예정", value: stats.expiringLic+"개", sub:"30일 이내", warn: stats.expiringLic>0 },
          { label:"등록 사용자", value: stats.totalUsers+"명", sub:"활성" },
        ].map((c,i)=>(
          <div key={i} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:"16px 18px" }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:26, fontWeight:500, color: c.warn?"#e65100":"var(--color-text-primary)", lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:5 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:20 }}>
          <h3 style={{ fontSize:14, fontWeight:500, marginBottom:16 }}>유형별 하드웨어 현황</h3>
          {Object.entries(HW_TYPES).map(([type,label])=>{
            const cnt = hardware.filter(h=>h.type===type).length;
            const pct = hardware.length ? Math.round(cnt/hardware.length*100) : 0;
            return (
              <div key={type} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <span style={{ width:52, fontSize:13, color:"var(--color-text-secondary)", flexShrink:0 }}>{label}</span>
                <div style={{ flex:1, height:8, background:"var(--color-background-secondary)", borderRadius:4 }}>
                  <div style={{ width:`${pct}%`, height:8, background:"#1d9e75", borderRadius:4, transition:"width 0.6s ease" }} />
                </div>
                <span style={{ width:20, fontSize:13, fontWeight:500, textAlign:"right" }}>{cnt}</span>
              </div>
            );
          })}
          <div style={{ borderTop:"0.5px solid var(--color-border-tertiary)", marginTop:16, paddingTop:12 }}>
            {Object.entries(HW_STATUS).map(([k,v])=>(
              <span key={k} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, marginRight:12, color:"var(--color-text-secondary)" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:STATUS_COLOR[k]?.dot, display:"inline-block" }} />{v} {hardware.filter(h=>h.status===k).length}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:20 }}>
          <h3 style={{ fontSize:14, fontWeight:500, marginBottom:16 }}>⚠️ 주의 사항</h3>
          {repairs.length > 0 && (
            <div style={{ background:"#fff3e0", border:"0.5px solid #ffe0b2", borderRadius:8, padding:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:500, color:"#e65100", marginBottom:4 }}>🔧 수리 중인 장비 ({repairs.length}개)</div>
              {repairs.slice(0,3).map(h => <div key={h.id} style={{ fontSize:11, color:"#e65100" }}>• {h.name}</div>)}
              {repairs.length > 3 && <div style={{ fontSize:11, color:"#e65100" }}>• 외 {repairs.length-3}개</div>}
            </div>
          )}
          {expiring.length > 0 && (
            <div style={{ background:"#fff8e1", border:"0.5px solid #ffe082", borderRadius:8, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:500, color:"#f57f17", marginBottom:4 }}>📅 만료 예정 라이선스 ({expiring.length}개)</div>
              {expiring.slice(0,3).map(l => <div key={l.id} style={{ fontSize:11, color:"#f57f17" }}>• {l.name} (D-{daysUntil(l.expiryDate)})</div>)}
              {expiring.length > 3 && <div style={{ fontSize:11, color:"#f57f17" }}>• 외 {expiring.length-3}개</div>}
            </div>
          )}
          {repairs.length === 0 && expiring.length === 0 && (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>🎉 주의할 사항이 없습니다.</div>
          )}
        </div>
      </div>

      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:20 }}>
        <h3 style={{ fontSize:14, fontWeight:500, marginBottom:12 }}>최근 로그</h3>
        {history.slice(0,5).length === 0 ? (
          <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>로그가 없습니다.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {history.slice(0,5).map(h => (
              <div key={h.id} style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", background:"var(--color-background-secondary)", borderRadius:8, fontSize:12 }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:500, color: Object.values(actionColor).includes((actionColor[h.action] || "var(--color-text-primary)")) ? actionColor[h.action] : "var(--color-text-primary)" }}>{h.action}</span>
                  <span style={{ color:"var(--color-text-secondary)", marginLeft:8 }}>- {h.aName}</span>
                </div>
                <span style={{ color:"var(--color-text-secondary)", whiteSpace:"nowrap" }}>{fDateTime(h.ts)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop:12 }}>
          <Btn onClick={()=>setView("history")} variant="ghost">모든 로그 보기 →</Btn>
        </div>
      </div>
    </div>
  );
}

// ===================== AI PAGE =====================
function AIPage({ hardware, licenses, users, history }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role:"user", text:userMsg }]);
    setLoading(true);

    try {
      const data = {
        hw: hardware.map(h => ({ name:h.name, type:h.type, status:h.status, cost:h.cost })),
        lic: licenses.map(l => ({ name:l.name, vendor:l.vendor, cost:l.cost, expiryDate:l.expiryDate })),
        users: users.length,
        recentHistory: history.slice(0,10),
      };
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{ role:"user", content:`IT 자산 관리 시스템 데이터: ${JSON.stringify(data)}\n\n사용자 질문: ${userMsg}` }]
        })
      });

      if (!response.ok) throw new Error("API 호출 실패");
      const result = await response.json();
      const assistantMsg = result.content[0]?.text || "응답을 생성할 수 없습니다.";
      setMessages(prev => [...prev, { role:"assistant", text:assistantMsg }]);
    } catch (err) {
      setMessages(prev => [...prev, { role:"assistant", text:`오류: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "현재 자산 현황을 요약해줄래?",
    "비용이 가장 많이 드는 자산은?",
    "라이선스 만료가 임박한 건 뭐가 있어?",
    "사용자별 배정 자산 현황은?",
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"var(--color-background-tertiary)" }}>
      <div style={{ padding:"28px 32px", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:500 }}>AI 어시스턴트</h1>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"var(--color-text-secondary)" }}>IT 자산에 관해 물어보세요</p>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"20px 32px", display:"flex", flexDirection:"column", gap:12 }}>
        {messages.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--color-text-secondary)", fontSize:13 }}>
            질문을 입력하면 AI가 답변해드립니다.
          </div>
        )}
        {messages.map((msg,i) => (
          <div key={i} style={{ display:"flex", justifyContent: msg.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"70%", padding:"12px 16px", borderRadius:"12px 12px 12px 4px", background: msg.role==="user"?"#0f6e56":"var(--color-background-primary)", border: msg.role==="user"?"none":"0.5px solid var(--color-border-tertiary)", color: msg.role==="user"?"white":"var(--color-text-primary)", fontSize:13, lineHeight:"1.5" }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", justifyContent:"flex-start" }}>
            <div style={{ padding:"12px 16px", borderRadius:"12px 12px 12px 4px", background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", fontSize:13, color:"var(--color-text-secondary)" }}>
              답변 생성 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding:"12px 28px 16px", borderTop:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-primary)" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {quickQuestions.map((q,i)=>(
            <button key={i} onClick={()=>{ setInput(q); }} style={{ fontSize:11, padding:"4px 10px", borderRadius:16, border:"0.5px solid var(--color-border-secondary)", background:"var(--color-background-secondary)", cursor:"pointer", color:"var(--color-text-secondary)", transition:"all 0.15s" }}
              onMouseEnter={e=>e.target.style.background="var(--color-background-primary)"}
              onMouseLeave={e=>e.target.style.background="var(--color-background-secondary)"}>
              {q}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="IT 자산에 관해 궁금한 것을 물어보세요..." style={{ flex:1 }} disabled={loading} />
          <Btn onClick={send} variant="primary" disabled={loading || !input.trim()} style={{ flexShrink:0 }}>전송</Btn>
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function App() {
  const [view, setView] = useState("dashboard");
  const [hardware, setHardware] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [h,l,u,hi] = await Promise.all([
          window.storage.get("itam-hw"),
          window.storage.get("itam-lic"),
          window.storage.get("itam-users"),
          window.storage.get("itam-hist"),
        ]);
        setHardware(h ? JSON.parse(h.value) : INIT_HW);
        setLicenses(l ? JSON.parse(l.value) : INIT_LIC);
        setUsers(u ? JSON.parse(u.value) : INIT_USERS);
        setHistory(hi ? JSON.parse(hi.value) : INIT_HIST);
      } catch {
        setHardware(INIT_HW); setLicenses(INIT_LIC); setUsers(INIT_USERS); setHistory(INIT_HIST);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) window.storage.set("itam-hw", JSON.stringify(hardware)).catch(()=>{}); }, [hardware, ready]);
  useEffect(() => { if (ready) window.storage.set("itam-lic", JSON.stringify(licenses)).catch(()=>{}); }, [licenses, ready]);
  useEffect(() => { if (ready) window.storage.set("itam-users", JSON.stringify(users)).catch(()=>{}); }, [users, ready]);
  useEffect(() => { if (ready) window.storage.set("itam-hist", JSON.stringify(history)).catch(()=>{}); }, [history, ready]);

  const addHistory = useCallback((action, aType, aId, aName, uId, detail) => {
    const u = users.find(x=>x.id===uId);
    setHistory(prev => [{ id:genId(), ts:nowISO(), action, aType, aId, aName, uId, uName:u?.name||"시스템", detail }, ...prev].slice(0,500));
  }, [users]);

  if (!ready) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontSize:14, color:"var(--color-text-secondary)" }}>데이터 로딩 중...</div>;

  const stats = {
    totalHw: hardware.length,
    activeHw: hardware.filter(h=>h.status==="active").length,
    repairHw: hardware.filter(h=>h.status==="repair").length,
    totalLic: licenses.length,
    usedSeats: licenses.reduce((s,l)=>s+(l.assignedTo?.length||0),0),
    totalSeats: licenses.reduce((s,l)=>s+(l.totalSeats||0),0),
    expiringLic: licenses.filter(l=>{ const d=daysUntil(l.expiryDate); return d!==null&&d>=0&&d<=30; }).length,
    totalUsers: users.length,
  };

  const nav = [
    { id:"dashboard", label:"대시보드" },
    { id:"hardware", label:"하드웨어" },
    { id:"license", label:"소프트웨어 라이선스" },
    { id:"users", label:"사용자 관리" },
    { id:"history", label:"이력 관리" },
    { id:"trash", label:"휴지통" },
    { id:"ai", label:"AI 어시스턴트" },
  ];

  const alerts = stats.repairHw + stats.expiringLic;

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"var(--font-sans)", fontSize:14 }}>
      <div style={{ width:220, minHeight:"100vh", background:"var(--color-background-primary)", borderRight:"0.5px solid var(--color-border-tertiary)", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"20px 18px 14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, background:"#0f6e56", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:13, fontWeight:700, letterSpacing:-0.5 }}>IT</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>자산관리 시스템</div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>IT Asset Manager</div>
            </div>
          </div>
        </div>
        <div style={{ height:"0.5px", background:"var(--color-border-tertiary)", margin:"0 14px 10px" }} />
        <nav style={{ flex:1, padding:"0 10px" }}>
          {nav.map(item => (
            <button key={item.id} onClick={()=>setView(item.id)} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
              padding:"9px 12px", borderRadius:8, border:"none", cursor:"pointer", textAlign:"left",
              fontSize:13, marginBottom:2,
              background: view===item.id ? "#e1f5ee" : "transparent",
              color: view===item.id ? "#0f6e56" : "var(--color-text-secondary)",
              fontWeight: view===item.id ? 500 : 400,
            }}>
              {item.label}
              {item.id==="ai" && <span style={{ fontSize:10, background:"#0f6e56", color:"white", padding:"1px 6px", borderRadius:8, fontWeight:500 }}>AI</span>}
              {item.id==="dashboard" && alerts>0 && <span style={{ fontSize:10, background:"#e65100", color:"white", padding:"1px 6px", borderRadius:8 }}>{alerts}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding:"12px 18px", borderTop:"0.5px solid var(--color-border-tertiary)", fontSize:11, color:"var(--color-text-secondary)" }}>
          HW {stats.totalHw}개 · 라이선스 {stats.totalLic}개 · 사용자 {stats.totalUsers}명
        </div>
      </div>

      <div style={{ flex:1, background:"var(--color-background-tertiary)", overflow:"auto" }}>
        {view==="dashboard" && <Dashboard stats={stats} hardware={hardware} licenses={licenses} users={users} history={history} setView={setView} />}
        {view==="hardware" && <HardwarePage hardware={hardware} users={users} setHardware={setHardware} addHistory={addHistory} />}
        {view==="license" && <LicensePage licenses={licenses} users={users} setLicenses={setLicenses} addHistory={addHistory} />}
        {view==="users" && <UsersPage users={users} setUsers={setUsers} hardware={hardware} licenses={licenses} addHistory={addHistory} />}
        {view==="history" && <HistoryPage history={history} />}
        {view==="trash" && <TrashPage />}
        {view==="ai" && <AIPage hardware={hardware} licenses={licenses} users={users} history={history} />}
      </div>
    </div>
  );
}
