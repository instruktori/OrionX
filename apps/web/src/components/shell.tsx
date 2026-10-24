"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {LayoutDashboard,ShieldCheck,Settings2,FileBadge2,LockKeyhole,Menu,X,ArrowUpRight,Sparkles} from "lucide-react";
const links=[{href:"/",label:"Overview",icon:LayoutDashboard},{href:"/passport",label:"My Passport",icon:FileBadge2},{href:"/admin",label:"Administration",icon:Settings2},{href:"/verify",label:"Verification",icon:ShieldCheck}];
export function Shell({children}:{children:React.ReactNode}){
 const path=usePathname();const [open,setOpen]=useState(false);
 return <div className="shell">
  <aside className={open?"sidebar sidebar-open":"sidebar"} aria-label="Main navigation">
   <Link className="brand" href="/" onClick={()=>setOpen(false)} aria-label="OrionX home"><span className="brand-mark"><Sparkles size={19}/></span><span className="brand-name">orion<span>x</span><small>AI SKILLS PASSPORT</small></span></Link>
   <div className="nav-caption">WORKSPACE</div>
   <nav className="nav">{links.map(item=><Link key={item.href} href={item.href} aria-current={path===item.href?"page":undefined} className={path===item.href?"active":""} onClick={()=>setOpen(false)}><item.icon size={19}/><span>{item.label}</span></Link>)}</nav>
   <div className="sidefoot"><LockKeyhole size={18}/><b>Demo environment</b><p>All identities and achievements are fictional. No official BTU issuance is claimed.</p></div>
   <div className="sidebar-bottom"><span className="avatar">OX</span><div><b>OrionX</b><small>Devnet workspace</small></div></div>
  </aside>
  {open&&<button className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <div className="main"><header className="topbar">
   <div className="top-left"><button className="mobile-menu" aria-label={open?"Close menu":"Open menu"} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button><div className="breadcrumb">Workspace <span>/</span> <strong>{links.find(item=>item.href===path)?.label||"Overview"}</strong></div></div>
   <div className="top-actions"><Link className="top-docs" href="/verify">Public verifier <ArrowUpRight size={14}/></Link><span className="demo-chip"><span className="status-dot"/> DEMO MODE</span><Link className="top-docs" href="/login">Sign in</Link></div>
  </header><main id="main-content" className="content">{children}</main></div>
 </div>
}