import { useState, useEffect, useRef, useCallback } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
const nowISO = () => new Date().toISOString();
const fDate = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "-";
const fDateTime = (d) => d ? new Date(d).toLocaleString("ko-KR") : "-";
const fMoney = (n) => n ? `₩${Number(n).toLocaleString()}원` : "-";

const HW_TYPES = { desktop: "데스크탑", monitor: "모니터", laptop: "노트북" };
const HW_STATUS = { active: "사용중", inactive: "미사용", repair: "수리중", disposed: "폐기" };
const ROLES = { admin: "관리자", user: "사용자", viewer: "조회자" };

// [중요] 테스트용 계정 원본 데이터
const INIT_USERS = [
  { id: "u1", loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부", email: "admin@company.com", role: "admin", createdAt: nowISO() },
  { id: "u2", loginId: "user", password: "user123", name: "이영희", dept: "디자인팀", email: "lee@company.com", role: "user", createdAt: nowISO() },
];

const INIT_HW = [
  { id: "h1", type: "laptop", name: "MacBook Pro 14인치", brand: "Apple", status: "active", assignedTo: "u1", purchaseDate: "2023-01-15", cost: 2800000, createdAt: nowISO() },
];

const INIT_LIC = [
  { id: "l1", name: "Microsoft 365", vendor: "Microsoft", totalSeats: 10, cost: 180000, createdAt: nowISO() },
];

// ===================== 유틸리티 함수 =====================
function exportToCSV(data, filename) {
  if (!data || data.length === 0) { alert("내보낼 데이터 없음"); return; }
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

function importFromCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const lines = e.target.result.split("\n").filter(l => l.trim());
      if (lines.length < 2) { alert("유효한 CSV 파일 아님"); return; }
      
      const headers = lines[0].split(",").map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const obj = {};
        let values = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes;
          else if (line[i] === "," && !inQuotes) { values.push(current); current = ""; }
          else current += line[i];
        }
        values.push(current);
        headers.forEach((h, i) => obj[h] = values[i]?.trim() || "");
        return obj;
      });
      callback(data);
    } catch (err) {
      alert("CSV 읽기 오류: " + err.message);
    }
  };
  reader.readAsText(file);
}

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

function Btn({ onClick, variant="default", children, style={}, disabled=false, type="button" }) {
  const styles = {
    default: { background:"#f5f5f5", color:"#333", border:"1px solid #ddd" },
    primary: { background:"#0f6e56", color:"#fff", border:"none" },
    danger: { background:"#ffebee", color:"#c62828", border:"1px solid #ffcdd2" },
    warning: { background:"#fff3e0", color:"#e65100", border:"1px solid #ffe0b2" },
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={{ padding:"8px 14px", borderRadius:6, fontSize:12, fontWeight:500, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, ...styles[variant], ...style }}>{children}</button>;
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

// ===================== HARDWARE PAGE =====================
function HardwarePage({ hardware, users, setHardware, trash, setTrash, addHistory, canEdit }) {
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState({ type:"", status:"", search:"" });
  const [form, setForm] = useState({});
  const [importModal, setImportModal] = useState(false);

  const filtered = hardware.filter(h => {
    if (filter.type && h.type !== filter.type) return false;
    if (filter.status && h.status !== filter.status) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return h.name.toLowerCase().includes(q) || h.brand?.toLowerCase().includes(q);
    }
    return true;
  });

  const save = () => {
    if (!form.name?.trim()) return alert("자산명 입력필수");
    if (modal === "add") {
      const newHw = { ...form, id: genId(), createdAt: nowISO() };
      setHardware(prev => [newHw, ...prev]);
      addHistory("자산 등록", "hardware", newHw.id, newHw.name, "신규");
    } else {
      setHardware(prev => prev.map(h => h.id===form.id ? form : h));
      addHistory("자산 수정", "hardware", form.id, form.name, "수정됨");
    }
    setModal(null);
  };

  const importCSV = (data) => {
    let count = 0;
    data.forEach(row => {
      if (row.name?.trim()) {
        const newHw = { ...row, id: genId(), status: row.status || "active", createdAt: nowISO() };
        setHardware(prev => [newHw, ...prev]);
        count++;
      }
    });
    alert(`${count}개 자산 등록됨`);
    setImportModal(false);
  };

  const cols = [
    { label:"자산명", render: h => <strong>{h.name}</strong> },
    { label:"유형", render: h => HW_TYPES[h.type] || "-" },
    { label:"상태", render: h => <span style={{ padding:"2px 8px", background:h.status==="active"?"#e8f5e9":"#f5f5f5", borderRadius:4, fontSize:11 }}>{HW_STATUS[h.status]}</span> },
    { label:"비용", render: h => fMoney(h.cost) },
    { label:"", render: h => (
      <div style={{ display:"flex", gap:4 }}>
        {canEdit && <Btn onClick={()=>{setForm(h); setModal("edit");}} variant="default" style={{fontSize:11}}>수정</Btn>}
        {canEdit && <Btn onClick={()=>{setHardware(p=>p.filter(x=>x.id!==h.id)); setTrash(t=>[{...h, type:"hardware", deletedAt: nowISO()}, ...t]); addHistory("자산 삭제", "hardware", h.id, h.name, "삭제됨");}} variant="danger" style={{fontSize:11}}>삭제</Btn>}
      </div>
    )},
  ];

  return (
    <div style={{ padding:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0 }}>하드웨어 관리</h2>
        <div style={{display:"flex", gap:8}}>
          <Btn onClick={()=>exportToCSV(filtered, "하드웨어")} variant="default">CSV 내보내기</Btn>
          {canEdit && <Btn onClick={()=>setImportModal(true)} variant="primary">📥 CSV 가져오기</Btn>}
          {canEdit && <Btn onClick={()=>{setForm({status:"active"}); setModal("add");}} variant="primary">+ 등록</Btn>}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input placeholder="검색" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, padding:"8px", border:"1px solid #ddd", borderRadius:6 }} />
        <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ padding:"8px", border:"1px solid #ddd", borderRadius:6 }}>
          <option value="">전체 유형</option>
          {Object.entries(HW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Table cols={cols} rows={filtered} empty="하드웨어 없음" />

      {importModal && (
        <Modal title="CSV 파일로 대량 등록" onClose={()=>setImportModal(false)}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block", marginBottom:8}}>CSV 파일 선택:</label>
            <input type="file" accept=".csv" onChange={(e)=>{ if(e.target.files[0]) importFromCSV(e.target.files[0], importCSV); }} style={{padding:8, border:"1px solid #ddd", borderRadius:6, width:"100%", boxSizing:"border-box"}} />
          </div>
          <div style={{fontSize:12, color:"#666", marginBottom:12}}>
            필수 컬럼: name, type, brand, status, cost<br/>
            예: MacBook Pro, laptop, Apple, active, 2800000
          </div>
          <div style={{display:"flex", justifyContent:"flex-end", gap:8}}>
            <Btn onClick={()=>setImportModal(false)}>취소</Btn>
          </div>
        </Modal>
      )}

      {modal && canEdit && (
        <Modal title={modal==="add"?"자산 등록":"자산 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>자산명 *</label><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>유형</label><select value={form.type||""} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}}><option value="">선택</option>{Object.entries(HW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>브랜드</label><input value={form.brand||""} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>상태</label><select value={form.status||"active"} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}}>{Object.entries(HW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>비용</label><input type="number" value={form.cost||""} onChange={e=>setForm(f=>({...f,cost:Number(e.target.value)}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
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

// ===================== TRASH PAGE =====================
function TrashPage({ trash, setTrash, hardware, setHardware, licenses, setLicenses, users, setUsers, addHistory, canEdit }) {
  const [expandType, setExpandType] = useState(null);

  const restore = (item) => {
    if (item.type === "hardware") {
      setHardware(prev => [item, ...prev]);
      setTrash(t => t.filter(x => x.id !== item.id));
      addHistory("자산 복구", "hardware", item.id, item.name, "휴지통에서 복구");
    } else if (item.type === "license") {
      setLicenses(prev => [item, ...prev]);
      setTrash(t => t.filter(x => x.id !== item.id));
      addHistory("라이선스 복구", "license", item.id, item.name, "휴지통에서 복구");
    } else if (item.type === "user") {
      setUsers(prev => [item, ...prev]);
      setTrash(t => t.filter(x => x.id !== item.id));
      addHistory("사용자 복구", "user", item.id, item.name, "휴지통에서 복구");
    }
  };

  const hardwareTrash = trash.filter(t => t.type === "hardware");
  const licenseTrash = trash.filter(t => t.type === "license");
  const userTrash = trash.filter(t => t.type === "user");

  return (
    <div style={{ padding:"20px" }}>
      <h2 style={{ margin:"0 0 16px" }}>🗑️ 휴지통</h2>

      {trash.length === 0 ? (
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:20, borderRadius:8, textAlign:"center", color:"#999" }}>
          휴지통이 비어있습니다.
        </div>
      ) : (
        <>
          {hardwareTrash.length > 0 && (
            <div style={{ background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, marginBottom:16, padding:16 }}>
              <h3 style={{ margin:"0 0 12px", cursor:"pointer", userSelect:"none" }} onClick={()=>setExpandType(expandType==="hw"?null:"hw")}>
                📦 하드웨어 ({hardwareTrash.length})
              </h3>
              {expandType === "hw" && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {hardwareTrash.map(item => (
                    <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:12, background:"#fafafa", borderRadius:6 }}>
                      <div>
                        <div style={{fontWeight:500}}>{item.name}</div>
                        <div style={{fontSize:11, color:"#999"}}>삭제됨: {fDateTime(item.deletedAt)}</div>
                      </div>
                      {canEdit && <Btn onClick={()=>restore(item)} variant="warning" style={{fontSize:11}}>복구</Btn>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {licenseTrash.length > 0 && (
            <div style={{ background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, marginBottom:16, padding:16 }}>
              <h3 style={{ margin:"0 0 12px", cursor:"pointer", userSelect:"none" }} onClick={()=>setExpandType(expandType==="lic"?null:"lic")}>
                📋 라이선스 ({licenseTrash.length})
              </h3>
              {expandType === "lic" && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {licenseTrash.map(item => (
                    <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:12, background:"#fafafa", borderRadius:6 }}>
                      <div>
                        <div style={{fontWeight:500}}>{item.name}</div>
                        <div style={{fontSize:11, color:"#999"}}>삭제됨: {fDateTime(item.deletedAt)}</div>
                      </div>
                      {canEdit && <Btn onClick={()=>restore(item)} variant="warning" style={{fontSize:11}}>복구</Btn>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {userTrash.length > 0 && (
            <div style={{ background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, padding:16 }}>
              <h3 style={{ margin:"0 0 12px", cursor:"pointer", userSelect:"none" }} onClick={()=>setExpandType(expandType==="user"?null:"user")}>
                👤 사용자 ({userTrash.length})
              </h3>
              {expandType === "user" && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {userTrash.map(item => (
                    <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:12, background:"#fafafa", borderRadius:6 }}>
                      <div>
                        <div style={{fontWeight:500}}>{item.name}</div>
                        <div style={{fontSize:11, color:"#999"}}>삭제됨: {fDateTime(item.deletedAt)}</div>
                      </div>
                      {canEdit && <Btn onClick={()=>restore(item)} variant="warning" style={{fontSize:11}}>복구</Btn>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
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
    { label:"내용", render: h => <span style={{fontSize:11}}>{h.detail}</span> },
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

// ===================== LICENSE PAGE =====================
function LicensePage({ licenses, setLicenses, trash, setTrash, addHistory, canEdit }) {
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState({ search:"" });
  const [form, setForm] = useState({});
  const [importModal, setImportModal] = useState(false);

  const filtered = licenses.filter(l => {
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.vendor?.toLowerCase().includes(q);
    }
    return true;
  });

  const save = () => {
    if (!form.name?.trim()) return alert("라이선스명 입력필수");
    if (modal === "add") {
      const newL = { ...form, id: genId(), createdAt: nowISO() };
      setLicenses(prev => [newL, ...prev]);
      addHistory("라이선스 등록", "license", newL.id, newL.name, "등록됨");
    } else {
      setLicenses(prev => prev.map(l => l.id===form.id ? form : l));
      addHistory("라이선스 수정", "license", form.id, form.name, "수정됨");
    }
    setModal(null);
  };

  const importCSV = (data) => {
    let count = 0;
    data.forEach(row => {
      if (row.name?.trim()) {
        const newL = { ...row, id: genId(), createdAt: nowISO() };
        setLicenses(prev => [newL, ...prev]);
        count++;
      }
    });
    alert(`${count}개 라이선스 등록됨`);
    setImportModal(false);
  };

  const cols = [
    { label:"라이선스명", render: l => <strong>{l.name}</strong> },
    { label:"공급사", render: l => l.vendor },
    { label:"좌석", render: l => l.totalSeats || "-" },
    { label:"만료일", render: l => fDate(l.expiryDate) },
    { label:"비용", render: l => fMoney(l.cost) },
    { label:"", render: l => (
      <div style={{ display:"flex", gap:4 }}>
        {canEdit && <Btn onClick={()=>{setForm(l); setModal("edit");}} variant="default" style={{fontSize:11}}>수정</Btn>}
        {canEdit && <Btn onClick={()=>{setLicenses(p=>p.filter(x=>x.id!==l.id)); setTrash(t=>[{...l, type:"license", deletedAt:nowISO()}, ...t]); addHistory("라이선스 삭제", "license", l.id, l.name, "삭제됨");}} variant="danger" style={{fontSize:11}}>삭제</Btn>}
      </div>
    )},
  ];

  return (
    <div style={{ padding:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0 }}>라이선스 관리</h2>
        <div style={{display:"flex", gap:8}}>
          <Btn onClick={()=>exportToCSV(filtered, "라이선스")} variant="default">CSV 내보내기</Btn>
          {canEdit && <Btn onClick={()=>setImportModal(true)} variant="primary">📥 CSV 가져오기</Btn>}
          {canEdit && <Btn onClick={()=>{setForm({}); setModal("add");}} variant="primary">+ 등록</Btn>}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input placeholder="검색" value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, padding:"8px", border:"1px solid #ddd", borderRadius:6 }} />
      </div>

      <Table cols={cols} rows={filtered} empty="라이선스 없음" />

      {importModal && (
        <Modal title="CSV 파일로 대량 등록" onClose={()=>setImportModal(false)}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block", marginBottom:8}}>CSV 파일 선택:</label>
            <input type="file" accept=".csv" onChange={(e)=>{ if(e.target.files[0]) importFromCSV(e.target.files[0], importCSV); }} style={{padding:8, border:"1px solid #ddd", borderRadius:6, width:"100%", boxSizing:"border-box"}} />
          </div>
          <div style={{fontSize:12, color:"#666", marginBottom:12}}>
            필수 컬럼: name, vendor, cost
          </div>
          <div style={{display:"flex", justifyContent:"flex-end", gap:8}}>
            <Btn onClick={()=>setImportModal(false)}>취소</Btn>
          </div>
        </Modal>
      )}

      {modal && canEdit && (
        <Modal title={modal==="add"?"라이선스 등록":"라이선스 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>라이선스명 *</label><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>공급사</label><input value={form.vendor||""} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>좌석 수</label><input type="number" value={form.totalSeats||""} onChange={e=>setForm(f=>({...f,totalSeats:Number(e.target.value)}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>비용</label><input type="number" value={form.cost||""} onChange={e=>setForm(f=>({...f,cost:Number(e.target.value)}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>만료일</label><input type="date" value={form.expiryDate||""} onChange={e=>setForm(f=>({...f,expiryDate:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
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

// ===================== REPORTS PAGE =====================
function ReportsPage({ hardware, licenses, users, history }) {
  const [reportType, setReportType] = useState("overview");

  const stats = {
    totalHw: hardware.length,
    activeHw: hardware.filter(h=>h.status==="active").length,
    totalCost: hardware.reduce((s,h)=>s+(h.cost||0), 0) + licenses.reduce((s,l)=>s+(l.cost||0), 0),
    totalLic: licenses.length,
    totalUsers: users.length,
  };

  const hwByType = {};
  Object.keys(HW_TYPES).forEach(k => hwByType[k] = hardware.filter(h=>h.type===k).length);

  const historyByAction = {};
  history.forEach(h => historyByAction[h.action] = (historyByAction[h.action]||0) + 1);

  return (
    <div style={{ padding:"20px" }}>
      <h2 style={{ margin:"0 0 16px" }}>📊 보고서</h2>

      <div style={{display:"flex", gap:8, marginBottom:16}}>
        {[
          {id:"overview", label:"📈 개요"},
          {id:"hardware", label:"🖥️ 하드웨어"},
          {id:"cost", label:"💰 비용분석"},
          {id:"activity", label:"📝 활동현황"},
        ].map(r => (
          <Btn key={r.id} onClick={()=>setReportType(r.id)} variant={reportType===r.id?"primary":"default"}>{r.label}</Btn>
        ))}
      </div>

      {reportType === "overview" && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12}}>
          {[
            {label:"전체 자산", value:stats.totalHw, color:"#0f6e56"},
            {label:"활성 자산", value:stats.activeHw, color:"#1d9e75"},
            {label:"라이선스", value:stats.totalLic, color:"#1565c0"},
            {label:"사용자", value:stats.totalUsers, color:"#6a1b9a"},
          ].map((s,i) => (
            <div key={i} style={{background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8}}>
              <div style={{fontSize:12, color:"#666", marginBottom:8}}>{s.label}</div>
              <div style={{fontSize:28, fontWeight:600, color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {reportType === "hardware" && (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
          <div style={{background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8}}>
            <h3 style={{margin:"0 0 12px"}}>유형별 분포</h3>
            {Object.entries(hwByType).map(([type,count]) => (
              <div key={type} style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                <span style={{flex:1}}>{HW_TYPES[type]}</span>
                <div style={{width:100, height:8, background:"#f0f0f0", borderRadius:4, overflow:"hidden"}}>
                  <div style={{width:`${count*20}px`, height:8, background:"#0f6e56"}}></div>
                </div>
                <span style={{width:30, textAlign:"right", fontWeight:500}}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8}}>
            <h3 style={{margin:"0 0 12px"}}>상태별 분포</h3>
            {Object.entries(HW_STATUS).map(([status,label]) => {
              const cnt = hardware.filter(h=>h.status===status).length;
              return (
                <div key={status} style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                  <span style={{flex:1}}>{label}</span>
                  <div style={{width:100, height:8, background:"#f0f0f0", borderRadius:4, overflow:"hidden"}}>
                    <div style={{width:`${cnt*20}px`, height:8, background:status==="active"?"#4caf50":status==="repair"?"#ff9800":"#9e9e9e"}}></div>
                  </div>
                  <span style={{width:30, textAlign:"right", fontWeight:500}}>{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reportType === "cost" && (
        <div style={{background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8}}>
          <h3 style={{margin:"0 0 16px"}}>예산 분석</h3>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
            <div>
              <div style={{fontSize:12, color:"#666", marginBottom:4}}>하드웨어 총 비용</div>
              <div style={{fontSize:24, fontWeight:600, color:"#0f6e56"}}>{fMoney(hardware.reduce((s,h)=>s+(h.cost||0), 0))}</div>
            </div>
            <div>
              <div style={{fontSize:12, color:"#666", marginBottom:4}}>라이선스 총 비용</div>
              <div style={{fontSize:24, fontWeight:600, color:"#1565c0"}}>{fMoney(licenses.reduce((s,l)=>s+(l.cost||0), 0))}</div>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:12, color:"#666", marginBottom:4}}>전체 IT 비용</div>
              <div style={{fontSize:28, fontWeight:700, color:"#333"}}>{fMoney(stats.totalCost)}</div>
            </div>
          </div>
        </div>
      )}

      {reportType === "activity" && (
        <div style={{background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8}}>
          <h3 style={{margin:"0 0 16px"}}>액션별 활동현황</h3>
          {Object.entries(historyByAction).map(([action,count]) => (
            <div key={action} style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
              <span style={{flex:1, fontSize:12}}>{action}</span>
              <div style={{width:150, height:8, background:"#f0f0f0", borderRadius:4, overflow:"hidden"}}>
                <div style={{width:`${Math.min(count*10, 150)}px`, height:8, background:"#0f6e56"}}></div>
              </div>
              <span style={{width:40, textAlign:"right", fontWeight:500}}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== USERS PAGE =====================
function UsersPage({ users, setUsers, trash, setTrash, addHistory, canEdit, currentUser }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const save = () => {
    if (!form.name?.trim()) return alert("이름 입력필수");
    if (modal === "add") {
      const newUser = { ...form, id: genId(), createdAt: nowISO() };
      setUsers(prev => [newUser, ...prev]);
      addHistory("사용자 등록", "user", newUser.id, newUser.name, "등록됨");
    } else {
      setUsers(prev => prev.map(u => u.id===form.id ? form : u));
      addHistory("사용자 수정", "user", form.id, form.name, "수정됨");
    }
    setModal(null);
  };

  const cols = [
    { label:"이름", render: u => <strong>{u.name}</strong> },
    { label:"ID", render: u => u.loginId },
    { label:"부서", render: u => u.dept },
    { label:"역할", render: u => <span style={{padding:"2px 8px", background:u.role==="admin"?"#ffebee":"#f5f5f5", borderRadius:4, fontSize:11}}>{ROLES[u.role]}</span> },
    { label:"", render: u => (
      <div style={{display:"flex", gap:4}}>
        {(canEdit || currentUser.id === u.id) && <Btn onClick={()=>{setForm(u); setModal("edit");}} variant="default" style={{fontSize:11}}>수정</Btn>}
        {canEdit && currentUser.id !== u.id && <Btn onClick={()=>{setUsers(p=>p.filter(x=>x.id!==u.id)); setTrash(t=>[{...u, type:"user", deletedAt:nowISO()}, ...t]); addHistory("사용자 삭제", "user", u.id, u.name, "삭제됨");}} variant="danger" style={{fontSize:11}}>삭제</Btn>}
      </div>
    )},
  ];

  return (
    <div style={{ padding:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0 }}>사용자 관리</h2>
        {canEdit && <Btn onClick={()=>{setForm({role:"user"}); setModal("add");}} variant="primary">+ 추가</Btn>}
      </div>

      <Table cols={cols} rows={users} empty="사용자 없음" />

      {modal && (
        <Modal title={modal==="add"?"사용자 추가":"사용자 수정"} onClose={()=>setModal(null)}>
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>이름 *</label><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>로그인 ID</label><input value={form.loginId||""} onChange={e=>setForm(f=>({...f,loginId:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>비밀번호</label><input type="password" value={form.password||""} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            <div><label style={{display:"block", marginBottom:4, fontSize:12}}>부서</label><input value={form.dept||""} onChange={e=>setForm(f=>({...f,dept:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}} /></div>
            {canEdit && <div><label style={{display:"block", marginBottom:4, fontSize:12}}>역할</label><select value={form.role||"user"} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{width:"100%", padding:8, border:"1px solid #ddd", borderRadius:4, boxSizing:"border-box"}}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>}
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

// ===================== DASHBOARD =====================
function Dashboard({ stats, hardware, history }) {
  return (
    <div style={{ padding:"20px" }}>
      <h2 style={{ margin:"0 0 16px" }}>대시보드</h2>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>전체 자산</div>
          <div style={{fontSize:28, fontWeight:600}}>{stats.totalHw}</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>활성</div>
          <div style={{fontSize:28, fontWeight:600}}>{stats.activeHw}</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>라이선스</div>
          <div style={{fontSize:28, fontWeight:600}}>{stats.totalLic}</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
          <div style={{fontSize:12, color:"#666", marginBottom:4}}>사용자</div>
          <div style={{fontSize:28, fontWeight:600}}>{stats.totalUsers}</div>
        </div>
      </div>

      <div style={{ background:"#fff", border:"1px solid #e0e0e0", padding:16, borderRadius:8 }}>
        <h3 style={{ margin:"0 0 12px" }}>최근 로그</h3>
        {history.slice(0,8).map(h => (
          <div key={h.id} style={{display:"flex", justifyContent:"space-between", padding:8, fontSize:12, borderBottom:"1px solid #f0f0f0"}}>
            <span><strong>{h.action}</strong> - {h.aName}</span>
            <span style={{color:"#999"}}>{fDateTime(h.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== LOGIN PAGE =====================
function LoginPage({ onLogin, users }) {
  const [inputLoginId, setInputLoginId] = useState("");
  const [inputPassword, setInputPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // [중요] inputLoginId를 데이터베이스의 loginId 필드와 대조
    const foundUser = users.find(u => u.loginId === inputLoginId && u.password === inputPassword);
    
    if (foundUser) {
      onLogin(foundUser);
    } else {
      alert("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"#f0f2f5" }}>
      <div style={{ width:360, background:"#fff", padding:40, borderRadius:12, boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <h1 style={{ fontSize:24, color:"#0f6e56", margin:"0 0 8px" }}>IT 자산관리 시스템</h1>
          <p style={{ fontSize:13, color:"#666", margin:0 }}>관리 계정으로 로그인하세요</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:600, marginBottom:6 }}>아이디</label>
            <input 
              required 
              value={inputLoginId} 
              onChange={e=>setInputLoginId(e.target.value)} 
              placeholder="예: admin"
              style={{ width:"100%", padding:"12px", border:"1px solid #ddd", borderRadius:8, boxSizing:"border-box" }} 
            />
          </div>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:600, marginBottom:6 }}>비밀번호</label>
            <input 
              required 
              type="password" 
              value={inputPassword} 
              onChange={e=>setInputPassword(e.target.value)} 
              placeholder="Password 입력"
              style={{ width:"100%", padding:"12px", border:"1px solid #ddd", borderRadius:8, boxSizing:"border-box" }} 
            />
          </div>
          <Btn type="submit" variant="primary" style={{ padding:"14px", fontSize:14, fontWeight:600, marginTop:10 }}>로그인</Btn>
        </form>
        <div style={{ marginTop:24, padding:12, background:"#f8f9fa", borderRadius:8, fontSize:11, color:"#777" }}>
          <strong>테스트 계정:</strong><br/>
          관리자: <span style={{color:"#0f6e56", fontWeight:600}}>admin</span> / admin123<br/>
          사용자: <span style={{color:"#0f6e56", fontWeight:600}}>user</span> / user123
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function App() {
  const [view, setView] = useState("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [hardware, setHardware] = useState(() => {
    const saved = localStorage.getItem("itam-hw");
    return saved ? JSON.parse(saved) : INIT_HW;
  });
  const [licenses, setLicenses] = useState(() => {
    const saved = localStorage.getItem("itam-lic");
    return saved ? JSON.parse(saved) : INIT_LIC;
  });
  
  // 사용자 데이터 로드 시 테스트 계정이 있는지 확인하고 보정
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem("itam-users");
    let userList = saved ? JSON.parse(saved) : INIT_USERS;
    
    // 만약 admin이나 user 아이디를 가진 계정이 없다면 초기 데이터 강제 추가
    if (!userList.find(u => u.loginId === "admin")) {
        userList = [...INIT_USERS, ...userList.filter(u => u.loginId !== "admin" && u.loginId !== "user")];
    }
    return userList;
  });

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("itam-hist");
    return saved ? JSON.parse(saved) : [];
  });
  const [trash, setTrash] = useState(() => {
    const saved = localStorage.getItem("itam-trash");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => { localStorage.setItem("itam-hw", JSON.stringify(hardware)); }, [hardware]);
  useEffect(() => { localStorage.setItem("itam-lic", JSON.stringify(licenses)); }, [licenses]);
  useEffect(() => { localStorage.setItem("itam-users", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem("itam-hist", JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem("itam-trash", JSON.stringify(trash)); }, [trash]);

  const addHistory = useCallback((action, aType, aId, aName, detail) => {
    if (!currentUser) return;
    setHistory(prev => [{ id:genId(), ts:nowISO(), action, aType, aId, aName, detail, userId:currentUser.id }, ...prev]);
  }, [currentUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setView("dashboard");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} users={users} />;
  }

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "user";

  const stats = {
    totalHw: hardware.length,
    activeHw: hardware.filter(h=>h.status==="active").length,
    totalLic: licenses.length,
    totalUsers: users.length,
  };

  const nav = [
    { id:"dashboard", label:"대시보드", icon:"📊" },
    { id:"hardware", label:"하드웨어", icon:"🖥️" },
    { id:"license", label:"라이선스", icon:"📋" },
    { id:"users", label:"사용자", icon:"👤" },
    { id:"trash", label:"휴지통", icon:"🗑️" },
    { id:"history", label:"로그", icon:"📝" },
    { id:"reports", label:"보고서", icon:"📈" },
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#fff" }}>
      <div style={{ width:200, background:"#f8f8f8", borderRight:"1px solid #e0e0e0", padding:16, display:"flex", flexDirection:"column" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:"#0f6e56" }}>🖥️ IT 자산관리</div>
        <div style={{fontSize:11, marginBottom:16, padding:8, background:"#e8f5e9", borderRadius:6, color:"#0f6e56"}}>
          <div style={{fontWeight:600}}>{currentUser?.name}</div>
          <div style={{fontSize:10, marginTop:2}}>{ROLES[currentUser?.role]}</div>
        </div>
        <nav style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
          {nav.map(item => (
            <button key={item.id} onClick={()=>setView(item.id)} style={{ padding:"10px 12px", textAlign:"left", border:"none", background:view===item.id?"#e8f5e9":"transparent", color:view===item.id?"#0f6e56":"#333", borderRadius:6, cursor:"pointer", fontWeight:view===item.id?600:400, fontSize:13 }}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <Btn onClick={handleLogout} variant="default" style={{ padding:"10px 12px", fontSize:12, marginTop:10 }}>
          🚪 로그아웃
        </Btn>
      </div>

      <div style={{ flex:1, background:"#fafafa", overflow:"auto" }}>
        {view==="dashboard" && <Dashboard stats={stats} hardware={hardware} history={history} />}
        {view==="hardware" && <HardwarePage hardware={hardware} users={users} setHardware={setHardware} trash={trash} setTrash={setTrash} addHistory={addHistory} canEdit={canEdit} />}
        {view==="license" && <LicensePage licenses={licenses} setLicenses={setLicenses} trash={trash} setTrash={setTrash} addHistory={addHistory} canEdit={canEdit} />}
        {view==="users" && <UsersPage users={users} setUsers={setUsers} trash={trash} setTrash={setTrash} addHistory={addHistory} canEdit={canEdit} currentUser={currentUser} />}
        {view==="trash" && <TrashPage trash={trash} setTrash={setTrash} hardware={hardware} setHardware={setHardware} licenses={licenses} setLicenses={setLicenses} users={users} setUsers={setUsers} addHistory={addHistory} canEdit={canEdit} />}
        {view==="history" && <HistoryPage history={history} />}
        {view==="reports" && <ReportsPage hardware={hardware} licenses={licenses} users={users} history={history} />}
      </div>
    </div>
  );
}
