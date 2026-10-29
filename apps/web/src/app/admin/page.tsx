"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import { toMtavruli } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileBadge2,
  Users,
  PlusCircle,
  Activity,
  RefreshCw,
  Play,
  Square,
  Search,
  Download,
  QrCode,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  Link2,
  Unlink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { QrShareModal } from "@/components/qr-share-modal";
import { Dialog, Button } from "@/components/ui";
import { api, API, useSession } from "@/lib/session";

type OverviewStats = {
  passportsTotal: number;
  studentsTotal: number;
  versionsFinalized: number;
  awardsTotal: number;
  activeUpdates: number;
  sourceSpreadsheetUrl: string | null;
  jobs: {
    queued: number;
    running: number;
    retryWait: number;
    blocked: number;
    completed: number;
  };
  accounts: {
    workspacesTotal: number;
    workspacesUnlinked: number;
    bindingsStudent: number;
    bindingsAdmin: number;
    bindingsDual: number;
  };
  latestSyncRun: {
    id: string;
    state: string;
    totals: Record<string, number>;
    createdAt: string;
    _count?: { conflicts: number };
  } | null;
};

type PassportRow = {
  id: string;
  publicId: string;
  latestFinalizedVersion: number;
  activeVersionId: string | null;
  initialIssueDate: string;
  student: {
    id: string;
    externalId: string;
    firstName: string;
    lastName: string;
    email: string;
    program: string;
    educationLevel: string;
    status: string;
    identities?: Array<{
      id: string;
      role: string;
      subject: string;
      verifiedAt: string;
    }>;
  };
  _count: { versions: number };
};

type PassportDetail = {
  id: string;
  publicId: string;
  latestFinalizedVersion: number;
  activeVersionId: string | null;
  initialIssueDate: string;
  opaqueChainRef: string;
  student: {
    id: string;
    externalId: string;
    firstName: string;
    lastName: string;
    email: string;
    program: string;
    educationLevel: string;
    status: string;
    awards: Array<{
      id: string;
      sourceRecordId: string;
      skillId: string;
      name: string;
      category: string;
      badgeCode: string;
      description: string;
      earnedAt: string;
      firstIncludedVersion: number | null;
    }>;
    identities: Array<{
      id: string;
      provider: string;
      subject: string;
      role: string;
      verifiedBy: string;
      verifiedAt: string;
    }>;
  };
  versions: Array<{
    id: string;
    number: number;
    code: string;
    state: string;
    pageCount: number | null;
    pdfSha256: string | null;
    storageKey: string | null;
    txSignature: string | null;
    versionPda: string | null;
    finalizedSlot: string | null;
    chainCluster: string | null;
    createdAt: string;
    finalizedAt: string | null;
    snapshot: {
      awards?: Array<{
        recordId: string;
        name: string;
        category: string;
        badgeCode: string;
        dateEarned: string;
      }>;
    };
    jobs: Array<{
      id: string;
      stage: string;
      state: string;
      attempts: number;
      lastError: string | null;
    }>;
    writebacks: Array<{
      id: string;
      recordId: string;
      state: string;
      error: string | null;
    }>;
  }>;
  workspaces: Array<{
    workspaceId: string;
    email: string | null;
    subject: string;
    linkedStudentId: string | null;
  }>;
};

type AccountsPayload = {
  identities: Array<{
    id: string;
    provider: string;
    subject: string;
    role: string;
    studentId: string | null;
    verifiedBy: string;
    verifiedAt: string;
    student: {
      id: string;
      externalId: string;
      firstName: string;
      lastName: string;
      email: string;
      program: string;
      passport: { publicId: string; latestFinalizedVersion: number } | null;
    } | null;
    workspace: {
      workspaceId: string;
      email: string | null;
    } | null;
  }>;
  workspaces: Array<{
    workspaceId: string;
    email: string | null;
    subject: string;
    linkedStudentId: string | null;
    linkedAt: string | null;
    createdAt: string;
    linkedStudent: {
      id: string;
      externalId: string;
      firstName: string;
      lastName: string;
    } | null;
    binding: {
      role: string;
      studentId: string | null;
    } | null;
  }>;
  students: Array<{
    id: string;
    externalId: string;
    firstName: string;
    lastName: string;
    email: string;
    program: string;
    educationLevel: string;
    status: string;
    passport: {
      id: string;
      publicId: string;
      latestFinalizedVersion: number;
    } | null;
    identities: Array<{
      id: string;
      subject: string;
      role: string;
    }>;
  }>;
};

type JobItem = {
  id: string;
  type: string;
  stage: string;
  state: string;
  attempts: number;
  availableAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  version: {
    id: string;
    number: number;
    code: string;
    state: string;
    txSignature: string | null;
    passport: {
      id: string;
      publicId: string;
      student: {
        externalId: string;
        firstName: string;
        lastName: string;
      };
    };
  } | null;
};

type ConflictItem = {
  resolvedAt: string | null;
  id: string;
  runId: string;
  studentId: string | null;
  recordId: string | null;
  reason: string;
  createdAt: string;
};

type AuditItem = {
  id: string;
  actorId: string | null;
  action: string;
  targetId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

type CatalogSkill = {
  skillId: string;
  name: string;
  category: string;
  badgeCode: string;
  description: string;
};

export default function Admin() {
  const {t,locale} = useI18n();
  const router = useRouter();
  const { session, loading } = useSession();

  const [activeTab, setActiveTab] = useState<
    "passports" | "accounts" | "source" | "jobs"
  >("passports");

  // Overview & Sync/Processing state
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [bannerSuccess, setBannerSuccess] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    details: { label: string; value: string }[];
    label: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const stopProcessing = useRef(false);
  const [run, setRun] = useState<{
    id: string;
    state: string;
    totals: Record<string, number>;
  } | null>(null);

  // Passports tab state (server-side search & pagination)
  const [records, setRecords] = useState<PassportRow[]>([]);
  const [totalPassports, setTotalPassports] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedPassport, setSelectedPassport] =
    useState<PassportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [shareModal, setShareModal] = useState<{
    passportId: string;
    studentName: string;
    version: number;
    code: string;
    isLatest: boolean;
  } | null>(null);

  // People, Accounts & Access state
  const [accountsData, setAccountsData] = useState<AccountsPayload | null>(
    null,
  );
  const [accountQuery, setAccountQuery] = useState("");
  const [bindSubject, setBindSubject] = useState("");
  const [bindRole, setBindRole] = useState<"student" | "admin">("student");
  const [bindStudentRef, setBindStudentRef] = useState("");
  const [bindPreserveStudent, setBindPreserveStudent] = useState(true);
  const [linkWorkspaceId, setLinkWorkspaceId] = useState("");
  const [linkStudentRef, setLinkStudentRef] = useState("");
  const [accountActionPending, setAccountActionPending] = useState(false);

  // Source Entry & Awards state
  const [catalogSkills, setCatalogSkills] = useState<CatalogSkill[]>([]);
  const [catalogStudents, setCatalogStudents] = useState<
    Array<{
      id: string;
      externalId: string;
      firstName: string;
      lastName: string;
      email: string;
      program: string;
      educationLevel: string;
      status: string;
      passport: { publicId: string; latestFinalizedVersion: number } | null;
      awards: Array<{ skillId: string; sourceRecordId: string }>;
    }>
  >([]);
  const [awardStudentId, setAwardStudentId] = useState("BTU-T-0001");
  const [awardSkillId, setAwardSkillId] = useState("");
  const [awardDate, setAwardDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [awardRecordId, setAwardRecordId] = useState("");
  const [submittingAward, setSubmittingAward] = useState(false);

  // Jobs, Conflicts & Audit state
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [jobStateFilter, setJobStateFilter] = useState("ALL");
  const [auditEvents, setAuditEvents] = useState<AuditItem[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopProcessing.current = true;
    };
  }, []);

  // Automatically route non-admin students to /passport for centralized auth UX
  useEffect(() => {
    if (!loading && session && session.role === "student") {
      router.replace("/passport");
    }
  }, [loading, session, router]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await api("/admin/overview");
      setOverview(data);
      if (data.latestSyncRun && !run) {
        setRun(data.latestSyncRun);
      }
    } catch {
      // Handled by primary loaders
    }
  }, [run]);

  const loadPassports = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        envelope: "1",
        skip: String(page * pageSize),
        take: String(pageSize),
      });
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const data = await api(`/admin/passports?${params.toString()}`);
      if (Array.isArray(data)) {
        setRecords(data);
        setTotalPassports(data.length);
      } else {
        setRecords(data.items || []);
        setTotalPassports(data.total ?? 0);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("admin.loadStudents"),
      );
    }
  }, [page, pageSize, query, statusFilter]);

  const loadAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (accountQuery.trim()) params.set("q", accountQuery.trim());
      const data = await api(`/admin/accounts?${params.toString()}`);
      setAccountsData(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("admin.loadBindings"),
      );
    }
  }, [accountQuery]);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await api("/admin/catalog");
      setCatalogSkills(data.skills || []);
      setCatalogStudents(data.students || []);
      if (data.skills?.length && !awardSkillId) {
        setAwardSkillId(data.skills[0].skillId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.loadCatalog"));
    }
  }, [awardSkillId]);

  const loadJobsAndAudit = useCallback(async () => {
    try {
      const jobParams = new URLSearchParams({ state: jobStateFilter });
      const auditParams = new URLSearchParams({ envelope: "1", take: "100" });
      if (auditQuery.trim()) auditParams.set("q", auditQuery.trim());
      const [jobsRes, auditRes] = await Promise.all([
        api(`/admin/jobs?${jobParams.toString()}`),
        api(`/admin/audit?${auditParams.toString()}`),
      ]);
      setJobs(jobsRes.items || []);
      setConflicts(jobsRes.conflicts || []);
      setAuditEvents(Array.isArray(auditRes) ? auditRes : auditRes.items || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("admin.loadJobs"),
      );
    }
  }, [jobStateFilter, auditQuery]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadPassports()]);
    if (activeTab === "accounts") await loadAccounts();
    if (activeTab === "source") await loadCatalog();
    if (activeTab === "jobs") await loadJobsAndAudit();
  }, [
    activeTab,
    loadAccounts,
    loadCatalog,
    loadJobsAndAudit,
    loadOverview,
    loadPassports,
  ]);

  useEffect(() => {
    if (session?.role === "admin") {
      void loadOverview();
      void loadPassports();
    }
  }, [session?.role, loadOverview, loadPassports]);

  useEffect(() => {
    if (session?.role !== "admin") return;
    if (activeTab === "accounts") void loadAccounts();
    if (activeTab === "source") void loadCatalog();
    if (activeTab === "jobs") void loadJobsAndAudit();
  }, [session?.role, activeTab, loadAccounts, loadCatalog, loadJobsAndAudit]);

  const inspectPassport = async (publicIdOrId: string) => {
    setLoadingDetail(true);
    setError("");
    try {
      const detail = await api(
        `/admin/passports/${encodeURIComponent(publicIdOrId)}`,
      );
      setSelectedPassport(detail);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("admin.loadPassport"),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const processJobs = async () => {
    stopProcessing.current = false;
    setProcessing(true);
    setError("");
    setProgress(t("admin.checkingJobs"));
    let completedStages = 0;
    try {
      while (!stopProcessing.current) {
        const result = await api("/admin/jobs/process", { method: "POST" });
        if (result.processed) completedStages++;
        setProgress(
          `${completedStages} processing steps finished · ${result.remaining} jobs remaining${
            result.blocked
              ? ` · ${result.blocked} need administrator review`
              : ""
          }`,
        );
        if (!result.remaining) {
          await refreshAll();
          break;
        }
        const next = result.nextAvailableAt
          ? new Date(result.nextAvailableAt).getTime() - Date.now()
          : 2000;
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(10000, Math.max(2000, result.processed ? 2000 : next)),
          ),
        );
      }
      if (stopProcessing.current) {
        setProgress(
          t("admin.stopped"),
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("admin.processingUnavailable"),
      );
    } finally {
      setProcessing(false);
      await refreshAll();
    }
  };

  useEffect(() => {
    if (!run || !["QUEUED", "RUNNING"].includes(run.state)) return;
    const timer = setInterval(
      () =>
        api("/admin/sync-runs/" + run.id)
          .then((r) => {
            setRun(r);
            if (!["QUEUED", "RUNNING"].includes(r.state)) void refreshAll();
          })
          .catch((e) =>
            setError(
              e instanceof Error ? e.message : t("admin.syncFailed"),
            ),
          ),
      2000,
    );
    return () => clearInterval(timer);
  }, [run?.id, run?.state, refreshAll]);

  const performBindIdentity = async () => {
    setAccountActionPending(true);
    setError("");
    setBannerSuccess("");
    try {
      const payload: Record<string, unknown> = {
        subject: bindSubject.trim(),
        role: bindRole,
        preserveStudentLink: bindPreserveStudent,
      };
      if (bindStudentRef.trim()) {
        if (bindStudentRef.trim().startsWith("BTU-")) {
          payload.studentExternalId = bindStudentRef.trim();
        } else {
          payload.studentId = bindStudentRef.trim();
        }
      }
      await api("/admin/identities", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBannerSuccess(
        `Updated identity binding for subject ${bindSubject.trim()} as ${bindRole.toUpperCase()}.`,
      );
      setBindSubject("");
      setBindStudentRef("");
      await Promise.all([loadAccounts(), loadOverview(), loadPassports()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("admin.bindingFailed"),
      );
    } finally {
      setAccountActionPending(false);
    }
  };

  const performLinkWorkspace = async () => {
    setAccountActionPending(true);
    setError("");
    setBannerSuccess("");
    try {
      const ref = linkStudentRef.trim();
      const body = ref.startsWith("BTU-")
        ? { studentExternalId: ref }
        : { studentId: ref };
      await api(
        `/admin/workspaces/${encodeURIComponent(linkWorkspaceId.trim())}/link`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      setBannerSuccess(
        `Linked workspace ${linkWorkspaceId.trim()} to student ${ref}.`,
      );
      setLinkWorkspaceId("");
      setLinkStudentRef("");
      await Promise.all([loadAccounts(), loadOverview(), loadPassports()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.linkFailed"));
    } finally {
      setAccountActionPending(false);
    }
  };

  const performUnlinkSubject = async (subject: string) => {
    setAccountActionPending(true);
    setError("");
    setBannerSuccess("");
    try {
      await api("/admin/identities/unlink", {
        method: "POST",
        body: JSON.stringify({ subject }),
      });
      setBannerSuccess(`Removed binding for subject ${subject}.`);
      await Promise.all([loadAccounts(), loadOverview(), loadPassports()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.unlinkFailed"));
    } finally {
      setAccountActionPending(false);
    }
  };

  const performAddAward = async (andProcess: boolean) => {
    setSubmittingAward(true);
    setError("");
    setBannerSuccess("");
    try {
      const res = await api("/admin/source/awards", {
        method: "POST",
        body: JSON.stringify({
          studentId: awardStudentId,
          skillId: awardSkillId,
          dateEarned: awardDate,
          ...(awardRecordId.trim() ? { recordId: awardRecordId.trim() } : {}),
          autoSync: andProcess,
        }),
      });
      const createdRecordId = res.row?.award?.recordId || t("admin.newAward");
      setBannerSuccess(
        `Added award ${createdRecordId} (${awardSkillId}) for ${awardStudentId} in ${res.mode} source.`,
      );
      setAwardRecordId("");
      if (res.syncRun) {
        setRun(res.syncRun);
      }
      await loadCatalog();
      await loadOverview();
      if (andProcess) {
        await processJobs();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.addAwardFailed"),
      );
    } finally {
      setSubmittingAward(false);
    }
  };

  const handleBindIdentity = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmation({
      title: t("admin.changeAccess"),
      message:
        "This changes which university records and operations this account can access. Review the identity and role before continuing.",
      details: [
        { label: t("admin.accountSubject"), value: bindSubject.trim() },
        {
          label: t("admin.role"),
          value: bindRole === "admin" ? t("shell.adminRole") : t("admin.verifiedRole"),
        },
        {
          label: t("admin.studentRecord"),
          value:
            bindStudentRef.trim() ||
            (bindPreserveStudent
              ? t("admin.preserveLink")
              : t("admin.noLink")),
        },
      ],
      label: t("admin.confirmAccess"),
      action: performBindIdentity,
    });
  };
  const handleLinkWorkspace = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmation({
      title: t("admin.confirmLink"),
      message:
        "The workspace owner will gain access to this student's private passport. Check both identifiers carefully.",
      details: [
        { label: t("shell.workspace"), value: linkWorkspaceId.trim() },
        { label: t("admin.studentRecord"), value: linkStudentRef.trim() },
      ],
      label: t("admin.confirmStudent"),
      action: performLinkWorkspace,
    });
  };
  const handleUnlinkSubject = (subject: string) => {
    setConfirmation({
      title: t("admin.removeAccess"),
      message:
        "This removes the account's current role and student link. Issued credentials and student records are preserved.",
      details: [{ label: t("admin.accountSubject"), value: subject }],
      label: t("admin.removeBinding"),
      action: () => performUnlinkSubject(subject),
    });
  };
  const handleAddAward = (andProcess: boolean) => {
    setConfirmation({
      title: andProcess
        ? t("admin.recordProcess")
        : t("admin.recordConfirm"),
      message: andProcess
        ? t("admin.writesIssue")
        : t("admin.writesSource"),
      details: [
        { label: t("admin.studentRole"), value: awardStudentId },
        { label: "Skill", value: awardSkillId },
        { label: t("admin.earned"), value: awardDate },
      ],
      label: andProcess ? t("admin.recordAndProcess") : t("admin.recordAchievement"),
      action: () => performAddAward(andProcess),
    });
  };
  const confirmOperation = async () => {
    if (!confirmation || confirming) return;
    setConfirming(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } finally {
      setConfirming(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    setError("");
    setBannerSuccess("");
    try {
      await api(`/admin/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
      });
      setBannerSuccess(`Job ${jobId} reset to QUEUED.`);
      await loadJobsAndAudit();
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.retryFailed"));
    } finally {
      setRetryingJobId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalPassports / pageSize));
  const selectedSkillObj = catalogSkills.find(
    (s) => s.skillId === awardSkillId,
  );
  const selectedStudentObj = catalogStudents.find(
    (s) => s.externalId === awardStudentId,
  );

  return (
    <Shell>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("admin.eyebrow")}</div>
          <h1>{locale === "ka" ? toMtavruli(t("shell.administration")) : t("shell.administration")}</h1>
          <p className="lead">
            {t("admin.manageIntro")}
          </p>
        </div>
        <div className="page-actions">
          {session?.role === "admin" && overview?.sourceSpreadsheetUrl && (
            <a
              className="button secondary"
              href={overview.sourceSpreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("admin.openSheets")} <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
          {session?.studentId && (
            <Link className="button secondary" href="/passport">
              <FileBadge2 size={16} /> {t("admin.personalPassport")}
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <p className="loading-state" role="status">
          {t("admin.loadingSession")}
        </p>
      ) : !session ? (
        <section className="card access-card">
          <div>
            <span className="pill pill-blue" style={{ marginBottom: 10 }}>
              {t("admin.centralAuth")}
            </span>
            <h2>{t("admin.signIn")}</h2>
            <p className="muted">
              {t("admin.signInHelp")}
            </p>
          </div>
          <Link className="button" href="/login?next=/admin">
            {t("admin.google")}
          </Link>
        </section>
      ) : session.role !== "admin" ? (
        <section className="card" style={{ maxWidth: 620 }}>
          <span className="pill pill-pink">{t("admin.studentSession")}</span>
          <h2 style={{ marginTop: 12 }}>{t("admin.redirecting")}</h2>
          <p className="muted">
            {t("admin.signedAs")} <b>{session.email || session.subject}</b>. Student
            accounts are routed directly to their personal passport workspace.
          </p>
          <div className="page-actions" style={{ marginTop: 16 }}>
            <Link className="button" href="/passport">
              {t("admin.openMyPassport")}
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Top 4-Card Bento KPI Ribbon */}
          <div className="stats admin-kpi-grid">
            <section className="card kpi-card kpi-blue">
              <div className="stat-top">
                <span className="stat-label">{t("admin.passportsStudents")}</span>
                <FileBadge2 size={18} />
              </div>
              <div className="stat-value">
                {overview ? overview.passportsTotal : records.length}
              </div>
              <div className="stat-bottom">
                {overview
                  ? `${overview.studentsTotal} students · ${overview.activeUpdates} updating`
                  : t("admin.databaseTotal")}
              </div>
            </section>

            <section className="card kpi-card kpi-cyan">
              <div className="stat-top">
                <span className="stat-label">{t("admin.finalizedVersions")}</span>
                <Layers size={18} />
              </div>
              <div className="stat-value">
                {overview
                  ? overview.versionsFinalized
                  : records.reduce((n, p) => n + p.latestFinalizedVersion, 0)}
              </div>
              <div className="stat-bottom">
                {overview
                  ? `${overview.awardsTotal} cumulative skill awards`
                  : t("admin.anchored")}
              </div>
            </section>

            <section className="card kpi-card kpi-pink">
              <div className="stat-top">
                <span className="stat-label">{t("admin.identity")}</span>
                <Users size={18} />
              </div>
              <div className="stat-value">
                {overview
                  ? overview.accounts.bindingsStudent +
                    overview.accounts.bindingsAdmin
                  : "—"}
              </div>
              <div className="stat-bottom">
                {overview
                  ? `${overview.accounts.bindingsAdmin} admins (${overview.accounts.bindingsDual} dual) · ${overview.accounts.workspacesUnlinked} unlinked`
                  : t("admin.serverAccounts")}
              </div>
            </section>

            <section
              className={`card kpi-card ${
                (overview?.jobs.blocked || 0) > 0 ? "kpi-crimson" : "kpi-blue"
              }`}
            >
              <div className="stat-top">
                <span className="stat-label">{t("admin.queue")}</span>
                <Activity size={18} />
              </div>
              <div className="stat-value">
                {overview
                  ? overview.jobs.queued +
                    overview.jobs.running +
                    overview.jobs.retryWait
                  : 0}
              </div>
              <div className="stat-bottom">
                {overview
                  ? `${overview.jobs.blocked} failed/blocked · ${overview.jobs.completed} completed`
                  : t("admin.durableQueue")}
              </div>
            </section>
          </div>

          {/* Synchronize & Manual Stage Processor Bento Bar */}
          <section
            className="card sync-command-card"
            style={{ marginBottom: 24 }}
          >
            <div
              className="section-head"
              style={{ marginTop: 0, marginBottom: 12, flexWrap: "wrap" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0 }}>
                    {t("admin.syncQueue")}
                  </h2>
                  {run && (
                    <span
                      className={`pill ${
                        run.state.includes("CONFLICT") || run.state === "FAILED"
                          ? "pill-crimson"
                          : run.state === "COMPLETED"
                            ? "pill-cyan"
                            : "pill-blue"
                      }`}
                    >
                      {run.state.replaceAll("_", " ")}
                    </span>
                  )}
                </div>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  {t("admin.syncIntro")}
                </p>
              </div>
              <div className="page-actions">
                <button
                  className="button"
                  disabled={syncing || processing}
                  onClick={async () => {
                    setSyncing(true);
                    setError("");
                    setBannerSuccess("");
                    try {
                      setRun(
                        await api("/admin/sync", {
                          method: "POST",
                          headers: { "Idempotency-Key": crypto.randomUUID() },
                        }),
                      );
                      await refreshAll();
                      await processJobs();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : t("admin.syncUnavailable"),
                      );
                    } finally {
                      setSyncing(false);
                    }
                  }}
                >
                  <RefreshCw size={15} />
                  {syncing ? "Synchronizing…" : t("admin.sync")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={processing || syncing}
                  onClick={() => void processJobs()}
                >
                  <Play size={15} />
                  {processing ? t("admin.processing") : t("admin.processPending")}
                </button>
                {processing && (
                  <button
                    type="button"
                    className="button button-crimson"
                    onClick={() => {
                      stopProcessing.current = true;
                      setProgress(
                        t("admin.finishing"),
                      );
                    }}
                  >
                    <Square size={14} /> {t("admin.stopAfter")}
                  </button>
                )}
              </div>
            </div>

            {progress && (
              <div role="status" aria-live="polite" className="progress-banner">
                <Sparkles size={15} />
                <span>{progress}</span>
              </div>
            )}

            {run && run.totals && Object.keys(run.totals).length > 0 && (
              <div role="status" className="sync-totals-strip">
                <strong>
                  Latest Sync Run ({run.state.replaceAll("_", " ")}):
                </strong>
                <span>
                  {Object.entries(run.totals)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </span>
              </div>
            )}

            {bannerSuccess && (
              <p
                role="status"
                className="notice notice-cyan"
                style={{ marginBottom: 0 }}
              >
                <CheckCircle2
                  size={15}
                  style={{ verticalAlign: "middle", marginRight: 6 }}
                />
                {bannerSuccess}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="notice notice-crimson"
                style={{ marginBottom: 0 }}
              >
                <AlertTriangle
                  size={15}
                  style={{ verticalAlign: "middle", marginRight: 6 }}
                />
                {error}
              </p>
            )}
          </section>

          {/* 4-Tab Bento Navigation */}
          <div
            className="admin-tabs"
            role="tablist"
            aria-label={t("admin.sections")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "passports"}
              className={
                activeTab === "passports" ? "admin-tab active" : "admin-tab"
              }
              onClick={() => setActiveTab("passports")}
            >
              <FileBadge2 size={16} />
              <span>{t("admin.passportsVersions")}</span>
              <span className="tab-count">
                {overview?.passportsTotal ?? records.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "accounts"}
              className={
                activeTab === "accounts" ? "admin-tab active" : "admin-tab"
              }
              onClick={() => setActiveTab("accounts")}
            >
              <Users size={16} />
              <span>{t("admin.people")}</span>
              {overview && overview.accounts.workspacesUnlinked > 0 && (
                <span className="tab-count tab-count-pink">
                  {overview.accounts.workspacesUnlinked} unlinked
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "source"}
              className={
                activeTab === "source" ? "admin-tab active" : "admin-tab"
              }
              onClick={() => setActiveTab("source")}
            >
              <PlusCircle size={16} />
              <span>{t("admin.sourceAwards")}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "jobs"}
              className={
                activeTab === "jobs" ? "admin-tab active" : "admin-tab"
              }
              onClick={() => setActiveTab("jobs")}
            >
              <Activity size={16} />
              <span>{t("admin.jobs")}</span>
              {overview && overview.jobs.blocked > 0 && (
                <span className="tab-count tab-count-crimson">
                  {overview.jobs.blocked} alert
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: PASSPORTS & VERSION INSPECTOR */}
          {activeTab === "passports" && (
            <section className="card">
              <div
                className="section-head"
                style={{ marginTop: 0, flexWrap: "wrap" }}
              >
                <div>
                  <h2>{t("admin.studentsDirectory")}</h2>
                  <p className="muted">
                    {t("admin.studentsIntro")}
                  </p>
                </div>
                <span className="pill pill-blue">
                  Showing {records.length} of {totalPassports} records
                </span>
              </div>

              <div className="admin-toolbar">
                <div
                  className="search-field"
                  style={{ flex: 1, maxWidth: 420 }}
                >
                  <Search size={16} />
                  <label htmlFor="student-search" className="sr-only">
                    {t("admin.searchStudents")}
                  </label>
                  <input
                    id="student-search"
                    aria-label={t("admin.searchStudents")}
                    placeholder={t("admin.searchStudentPlaceholder")}
                    className="input"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label={t("admin.clear")}
                      onClick={() => {
                        setQuery("");
                        setPage(0);
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div
                  className="filter-group"
                  role="group"
                  aria-label={t("admin.filterIssuance")}
                >
                  {[
                    { id: "ALL", label: t("admin.allRecords") },
                    { id: "ISSUED", label: t("common.finalized") },
                    { id: "PROCESSING", label: t("admin.updating") },
                    { id: "UNISSUED", label: t("admin.unissued") },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={statusFilter === f.id}
                      onClick={() => {
                        setStatusFilter(f.id);
                        setPage(0);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("admin.student")}</th>
                      <th>{t("admin.studentId")}</th>
                      <th>{t("admin.passportId")}</th>
                      <th>{t("admin.binding")}</th>
                      <th>{t("admin.issuedVersion")}</th>
                      <th>{t("admin.update")}</th>
                      <th>{t("admin.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((p) => {
                      const bindings = p.student.identities || [];
                      const hasAdmin = bindings.some((b) => b.role === "admin");
                      const hasStudent = bindings.some(
                        (b) => b.role === "student",
                      );
                      return (
                        <tr key={p.id}>
                          <td>
                            <b>
                              {p.student.firstName} {p.student.lastName}
                            </b>
                            <div className="muted">
                              {p.student.program} · {p.student.email}
                            </div>
                          </td>
                          <td className="mono">{p.student.externalId}</td>
                          <td className="mono">{p.publicId}</td>
                          <td>
                            {hasAdmin ? (
                              <span className="pill pill-pink">
                                {t("admin.adminLinked")}
                              </span>
                            ) : hasStudent ? (
                              <span className="pill pill-cyan">
                                {t("admin.verified")}
                              </span>
                            ) : (
                              <span className="pill">{t("admin.unbound")}</span>
                            )}
                          </td>
                          <td>
                            {p.latestFinalizedVersion ? (
                              <span className="pill pill-blue">
                                V{p.latestFinalizedVersion} ({p._count.versions}{" "}
                                total)
                              </span>
                            ) : (
                              <span className="pill">{t("admin.notIssued")}</span>
                            )}
                          </td>
                          <td>
                            {p.activeVersionId ? (
                              <span className="pill pill-pink">{t("admin.processingState")}</span>
                            ) : (
                              <span className="muted">{t("admin.none")}</span>
                            )}
                          </td>
                          <td>
                            <div className="page-actions">
                              <button
                                type="button"
                                className="button secondary btn-sm"
                                onClick={() => void inspectPassport(p.publicId)}
                              >
                                {t("admin.inspect")}
                              </button>
                              {p.latestFinalizedVersion > 0 && (
                                <a
                                  className="button btn-sm"
                                  href={`${API}/api/v1/admin/passports/${encodeURIComponent(p.publicId)}/versions/${p.latestFinalizedVersion}/download`}
                                >
                                  <Download size={13} /> V
                                  {p.latestFinalizedVersion} PDF
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!records.length && (
                <p role="status" className="muted" style={{ marginTop: 16 }}>
                  {t("admin.noMatching")}
                </p>
              )}

              {/* Pagination Controls */}
              <div className="pagination-bar">
                <div className="muted">
                  Page {page + 1} of {totalPages} ({totalPassports} total
                  passports)
                </div>
                <div className="page-actions">
                  <select
                    aria-label={t("admin.recordsPerPage")}
                    className="input select-sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                  >
                    <option value={10}>{t("admin.perPage10")}</option>
                    <option value={25}>{t("admin.perPage25")}</option>
                    <option value={50}>{t("admin.perPage50")}</option>
                    <option value={100}>{t("admin.perPage100")}</option>
                  </select>
                  <button
                    type="button"
                    className="button secondary btn-sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={14} /> {t("admin.previous")}
                  </button>
                  <button
                    type="button"
                    className="button secondary btn-sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    {t("admin.next")} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: PEOPLE, ACCOUNTS & ACCESS */}
          {activeTab === "accounts" && (
            <div className="bento-stack">
              <div className="columns">
                {/* Guided Link Workspace to Student Card */}
                <section className="card">
                  <div className="section-head" style={{ marginTop: 0 }}>
                    <div>
                      <h2>{t("admin.linkWorkspace")}</h2>
                      <p className="muted">
                        Associate a student’s Google workspace (
                        <code>WS-…</code>) with their official university
                        student record (<code>BTU-T-…</code>).
                      </p>
                    </div>
                    <Link2 size={20} color="var(--cyan)" />
                  </div>
                  <form onSubmit={handleLinkWorkspace} className="form-stack">
                    <div>
                      <label htmlFor="ws-id-input" className="field-label">
                        Workspace Identifier (WS-…)
                      </label>
                      <input
                        id="ws-id-input"
                        className="input mono"
                        placeholder="WS-ABCDEFGHIJKLMNOP"
                        value={linkWorkspaceId}
                        onChange={(e) => setLinkWorkspaceId(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="ws-student-input" className="field-label">
                        {t("admin.targetStudent")}
                      </label>
                      <input
                        id="ws-student-input"
                        className="input"
                        list="student-datalist"
                        placeholder="e.g. BTU-T-0001"
                        value={linkStudentRef}
                        onChange={(e) => setLinkStudentRef(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="button"
                      disabled={accountActionPending}
                    >
                      <Link2 size={15} />
                      {accountActionPending
                        ? t("admin.linking")
                        : t("admin.linkAndVerify")}
                    </button>
                  </form>
                </section>

                {/* Create / Update Identity Binding & Role Card */}
                <section className="card">
                  <div className="section-head" style={{ marginTop: 0 }}>
                    <div>
                      <h2>{t("admin.manageAccount")}</h2>
                      <p className="muted">
                        {t("admin.grant")} <b>{t("admin.studentRole")}</b> or <b>{t("shell.adminRole")}</b>{" "}
                        permissions for a Google subject ID, including dual-role
                        admin + student links.
                      </p>
                    </div>
                    <UserPlus size={20} color="var(--pink)" />
                  </div>
                  <form onSubmit={handleBindIdentity} className="form-stack">
                    <div>
                      <label
                        htmlFor="bind-subject-input"
                        className="field-label"
                      >
                        Immutable Google / Provider Subject ID (UUID)
                      </label>
                      <input
                        id="bind-subject-input"
                        className="input mono"
                        placeholder="e.g. f913b163-be04-4eeb-8b99-..."
                        value={bindSubject}
                        onChange={(e) => setBindSubject(e.target.value)}
                        required
                      />
                    </div>
                    <div className="columns" style={{ gap: 12 }}>
                      <div>
                        <label
                          htmlFor="bind-role-select"
                          className="field-label"
                        >
                          {t("admin.applicationRole")}
                        </label>
                        <select
                          id="bind-role-select"
                          className="input"
                          value={bindRole}
                          onChange={(e) =>
                            setBindRole(e.target.value as "student" | "admin")
                          }
                        >
                          <option value="student">{t("admin.verifiedStudent")}</option>
                          <option value="admin">{t("shell.adminRole")}</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="bind-student-input"
                          className="field-label"
                        >
                          Student Record{" "}
                          {bindRole === "admin"
                            ? t("admin.dual")
                            : "(Required)"}
                        </label>
                        <input
                          id="bind-student-input"
                          className="input"
                          list="student-datalist"
                          placeholder="e.g. BTU-T-0001"
                          value={bindStudentRef}
                          onChange={(e) => setBindStudentRef(e.target.value)}
                          required={bindRole === "student"}
                        />
                      </div>
                    </div>
                    {bindRole === "admin" && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={bindPreserveStudent}
                          onChange={(e) =>
                            setBindPreserveStudent(e.target.checked)
                          }
                        />
                        {t("admin.preserve")}
                      </label>
                    )}
                    <button
                      type="submit"
                      className="button"
                      disabled={accountActionPending}
                    >
                      <ShieldCheck size={15} />
                      {accountActionPending
                        ? t("admin.savingBinding")
                        : t("admin.saveRole")}
                    </button>
                  </form>
                </section>
              </div>

              <datalist id="student-datalist">
                {(accountsData?.students || []).map((s) => (
                  <option key={s.id} value={s.externalId}>
                    {s.firstName} {s.lastName} ({s.email})
                  </option>
                ))}
              </datalist>

              {/* Unified Search across Workspaces & Bindings */}
              <section className="card">
                <div
                  className="section-head"
                  style={{ marginTop: 0, flexWrap: "wrap" }}
                >
                  <div>
                    <h2>{t("admin.workspacesBindings")}</h2>
                    <p className="muted">
                      {t("admin.prefill")}
                    </p>
                  </div>
                  <div className="search-field" style={{ minWidth: 260 }}>
                    <Search size={16} />
                    <input
                      className="input"
                      aria-label={t("admin.searchAccounts")}
                      placeholder={t("admin.searchAccountPlaceholder")}
                      value={accountQuery}
                      onChange={(e) => setAccountQuery(e.target.value)}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: 15, margin: "12px 0 10px" }}>
                  1. Self-Registered Google Workspaces (
                  {accountsData?.workspaces.length ?? 0})
                </h3>
                <div className="table-wrap" style={{ marginBottom: 28 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("admin.workspaceId")}</th>
                        <th>{t("admin.googleEmail")}</th>
                        <th>{t("admin.subject")}</th>
                        <th>{t("admin.status")}</th>
                        <th>{t("admin.quickActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(accountsData?.workspaces || []).map((w) => (
                        <tr key={w.workspaceId}>
                          <td className="mono">{w.workspaceId}</td>
                          <td>
                            <b>{w.email || "—"}</b>
                          </td>
                          <td className="mono">{w.subject}</td>
                          <td>
                            {w.binding?.role === "admin" ? (
                              <span className="pill pill-blue">
                                ADMIN{" "}
                                {w.linkedStudent
                                  ? `· LINKED (${w.linkedStudent.externalId})`
                                  : ""}
                              </span>
                            ) : w.linkedStudent ? (
                              <span className="pill pill-cyan">
                                LINKED · {w.linkedStudent.externalId} (
                                {w.linkedStudent.firstName}{" "}
                                {w.linkedStudent.lastName})
                              </span>
                            ) : (
                              <span className="pill pill-pink">
                                {t("admin.unlinkedSelf")}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="page-actions">
                              {!w.linkedStudentId && (
                                <button
                                  type="button"
                                  className="button secondary btn-sm"
                                  onClick={() => {
                                    setLinkWorkspaceId(w.workspaceId);
                                    window.scrollTo({
                                      top: 260,
                                      behavior: "smooth",
                                    });
                                  }}
                                >
                                  {t("admin.selectWorkspace")}
                                </button>
                              )}
                              <button
                                type="button"
                                className="button secondary btn-sm"
                                onClick={() => {
                                  setBindSubject(w.subject);
                                  if (w.linkedStudent) {
                                    setBindStudentRef(
                                      w.linkedStudent.externalId,
                                    );
                                  }
                                  window.scrollTo({
                                    top: 260,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                {t("admin.editRole")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 style={{ fontSize: 15, margin: "12px 0 10px" }}>
                  2. Authoritative Identity Bindings (
                  {accountsData?.identities.length ?? 0})
                </h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("admin.roleLabel")}</th>
                        <th>{t("admin.emailWorkspace")}</th>
                        <th>{t("admin.subject")}</th>
                        <th>{t("admin.linkedStudent")}</th>
                        <th>{t("admin.verifiedAt")}</th>
                        <th>{t("admin.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(accountsData?.identities || []).map((idRow) => (
                        <tr key={idRow.id}>
                          <td>
                            <span
                              className={`pill ${
                                idRow.role === "admin"
                                  ? idRow.student
                                    ? "pill-pink"
                                    : "pill-blue"
                                  : "pill-cyan"
                              }`}
                            >
                              {idRow.role === "admin"
                                ? idRow.student
                                  ? t("admin.adminDual")
                                  : "ADMIN"
                                : t("admin.student")}
                            </span>
                          </td>
                          <td>
                            <b>
                              {idRow.workspace?.email ||
                                idRow.student?.email ||
                                "—"}
                            </b>
                            {idRow.workspace && (
                              <div className="muted mono">
                                {idRow.workspace.workspaceId}
                              </div>
                            )}
                          </td>
                          <td className="mono">{idRow.subject}</td>
                          <td>
                            {idRow.student ? (
                              <div>
                                <b>
                                  {idRow.student.firstName}{" "}
                                  {idRow.student.lastName}
                                </b>{" "}
                                (
                                <code className="mono">
                                  {idRow.student.externalId}
                                </code>
                                )
                                {idRow.student.passport && (
                                  <div className="muted mono">
                                    Passport: {idRow.student.passport.publicId}{" "}
                                    (V
                                    {
                                      idRow.student.passport
                                        .latestFinalizedVersion
                                    }
                                    )
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="muted">{t("admin.noLinked")}</span>
                            )}
                          </td>
                          <td className="mono">
                            {new Date(idRow.verifiedAt)
                              .toISOString()
                              .slice(0, 10)}
                          </td>
                          <td>
                            <div className="page-actions">
                              <button
                                type="button"
                                className="button secondary btn-sm"
                                onClick={() => {
                                  setBindSubject(idRow.subject);
                                  setBindRole(
                                    idRow.role === "admin"
                                      ? "student"
                                      : "admin",
                                  );
                                  setBindStudentRef(
                                    idRow.student?.externalId || "",
                                  );
                                  window.scrollTo({
                                    top: 260,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                {t("admin.changeRole")}
                              </button>
                              {idRow.subject !== session.subject && (
                                <button
                                  type="button"
                                  className="button secondary btn-sm"
                                  onClick={() =>
                                    void handleUnlinkSubject(idRow.subject)
                                  }
                                >
                                  <Unlink size={13} /> {t("admin.unbind")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: SOURCE ENTRY & AWARDS */}
          {activeTab === "source" && (
            <div className="columns">
              <section className="card">
                <div className="section-head" style={{ marginTop: 0 }}>
                  <div>
                    <h2>{t("admin.newSkill")}</h2>
                    <p className="muted">
                      Writes a validated student + skill award row directly to
                      the authoritative Google Sheet (preserving badge formulas
                      and row metadata) and optionally issues the next
                      cumulative passport version.
                    </p>
                  </div>
                </div>

                <div className="form-stack">
                  <div>
                    <label htmlFor="award-student" className="field-label">
                      {t("admin.selectStudent")}
                    </label>
                    <select
                      id="award-student"
                      className="input"
                      value={awardStudentId}
                      onChange={(e) => setAwardStudentId(e.target.value)}
                    >
                      {catalogStudents.map((s) => (
                        <option key={s.id} value={s.externalId}>
                          {s.externalId} — {s.firstName} {s.lastName} (
                          {s.program} · {s.awards.length} awards ·{" "}
                          {s.passport
                            ? `V${s.passport.latestFinalizedVersion}`
                            : "Unissued"}
                          )
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="award-skill" className="field-label">
                      {t("admin.selectSkill")}
                    </label>
                    <select
                      id="award-skill"
                      className="input"
                      value={awardSkillId}
                      onChange={(e) => setAwardSkillId(e.target.value)}
                    >
                      {catalogSkills.map((sk) => {
                        const alreadyEarned = selectedStudentObj?.awards.some(
                          (a) => a.skillId === sk.skillId,
                        );
                        return (
                          <option key={sk.skillId} value={sk.skillId}>
                            {sk.skillId} — {sk.name} [{sk.category} ·{" "}
                            {sk.badgeCode}]
                            {alreadyEarned ? t("admin.alreadyEarnedFull") : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="columns" style={{ gap: 12 }}>
                    <div>
                      <label htmlFor="award-date" className="field-label">
                        3. Date Earned (ISO YYYY-MM-DD)
                      </label>
                      <input
                        id="award-date"
                        type="date"
                        className="input"
                        value={awardDate}
                        onChange={(e) => setAwardDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="award-record-id" className="field-label">
                        4. Source Record ID (Optional)
                      </label>
                      <input
                        id="award-record-id"
                        className="input mono"
                        placeholder={t("admin.autoGenerated")}
                        value={awardRecordId}
                        onChange={(e) => setAwardRecordId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="page-actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="button"
                      disabled={submittingAward || processing || syncing}
                      onClick={() => void handleAddAward(true)}
                    >
                      <Sparkles size={15} />
                      {submittingAward
                        ? t("admin.writing")
                        : t("admin.saveIssue")}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={submittingAward || processing || syncing}
                      onClick={() => void handleAddAward(false)}
                    >
                      <PlusCircle size={15} /> {t("admin.saveSource")}
                    </button>
                  </div>
                </div>
              </section>

              <section className="card">
                <h2>{t("admin.preview")}</h2>
                {selectedStudentObj && (
                  <div className="identity-box" style={{ marginBottom: 16 }}>
                    <span className="mini-kicker">{t("admin.targetPassport")}</span>
                    <b>
                      {selectedStudentObj.firstName}{" "}
                      {selectedStudentObj.lastName} (
                      {selectedStudentObj.externalId})
                    </b>
                    <span className="muted">
                      Permanent ID:{" "}
                      <code className="mono">
                        {selectedStudentObj.passport?.publicId ||
                          t("admin.assigned")}
                      </code>{" "}
                      · Current Version:{" "}
                      <b>
                        V
                        {selectedStudentObj.passport?.latestFinalizedVersion ||
                          0}
                      </b>{" "}
                      → Next Cumulative Version:{" "}
                      <b>
                        V
                        {(selectedStudentObj.passport?.latestFinalizedVersion ||
                          0) + 1}
                      </b>
                    </span>
                  </div>
                )}

                {selectedSkillObj && (
                  <div className="award-item-card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span className="pill pill-pink">
                        {selectedSkillObj.category}
                      </span>
                      <span className="pill pill-cyan mono">
                        {selectedSkillObj.badgeCode}
                      </span>
                    </div>
                    <h3 style={{ margin: "6px 0" }}>
                      {selectedSkillObj.name} ({selectedSkillObj.skillId})
                    </h3>
                    <p className="muted">{selectedSkillObj.description}</p>
                  </div>
                )}

                <div className="notice" style={{ marginTop: 18 }}>
                  <strong>{t("admin.cumulative")}</strong> Existing awards
                  and historical versions (V1, V2…) remain immutable. Adding a
                  new award creates the next sequential version on the same
                  permanent Passport ID.
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: JOBS, CONFLICTS & AUDIT TRAIL */}
          {activeTab === "jobs" && (
            <div className="bento-stack">
              <section className="card">
                <div
                  className="section-head"
                  style={{ marginTop: 0, flexWrap: "wrap" }}
                >
                  <div>
                    <h2>{t("admin.durable")}</h2>
                    <p className="muted">
                      {t("admin.jobsIntro")}
                    </p>
                  </div>
                  <div
                    className="filter-group"
                    role="group"
                    aria-label={t("admin.filterJobs")}
                  >
                    {[
                      { id: "ALL", label: t("admin.allJobs") },
                      { id: "ACTIVE", label: t("admin.activeQueued") },
                      { id: "FAILED", label: t("admin.failedRetry") },
                      { id: "COMPLETED", label: t("admin.completed") },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={jobStateFilter === f.id}
                        onClick={() => setJobStateFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("admin.jobStage")}</th>
                        <th>{t("admin.jobState")}</th>
                        <th>{t("admin.passportVersion")}</th>
                        <th>{t("admin.attempts")}</th>
                        <th>{t("admin.diagnostic")}</th>
                        <th>{t("admin.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => {
                        const isRetryable = [
                          "FAILED_PERMANENT",
                          "RETRY_WAIT",
                          "STORED",
                        ].includes(j.state);
                        return (
                          <tr key={j.id}>
                            <td>
                              <b>
                                {j.type} · {j.stage}
                              </b>
                              <div className="muted mono">{j.id}</div>
                            </td>
                            <td>
                              <span
                                className={`pill ${
                                  j.state === "COMPLETED" ||
                                  j.state === "FINALIZED"
                                    ? "pill-cyan"
                                    : j.state.includes("FAIL") ||
                                        j.state.includes("BLOCK")
                                      ? "pill-crimson"
                                      : "pill-blue"
                                }`}
                              >
                                {j.state}
                              </span>
                            </td>
                            <td>
                              {j.version ? (
                                <div>
                                  <b>
                                    {j.version.passport.student.firstName}{" "}
                                    {j.version.passport.student.lastName}
                                  </b>
                                  <div className="muted mono">
                                    {j.version.passport.publicId} · V
                                    {j.version.number}
                                  </div>
                                </div>
                              ) : (
                                <span className="muted">{t("admin.syncJob")}</span>
                              )}
                            </td>
                            <td className="mono">{j.attempts}</td>
                            <td style={{ whiteSpace: "normal", maxWidth: 340 }}>
                              {j.lastError && !["COMPLETED", "FINALIZED"].includes(j.state) ? (
                                <span
                                  style={{
                                    color: "var(--crimson)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  {j.lastError}
                                </span>
                              ) : (
                                <span className="muted">{t("admin.noErrors")}</span>
                              )}
                            </td>
                            <td>
                              {isRetryable ? (
                                <button
                                  type="button"
                                  className="button btn-sm"
                                  disabled={retryingJobId === j.id}
                                  onClick={() => void handleRetryJob(j.id)}
                                >
                                  <RotateCcw size={13} />
                                  {retryingJobId === j.id
                                    ? "Retrying…"
                                    : t("admin.retry")}
                                </button>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!jobs.length && (
                  <p className="muted">{t("admin.noJobs")}</p>
                )}
              </section>

              {/* Source Conflicts */}
              {conflicts.length > 0 && (
                <section className="card">
                  <div className="section-head" style={{ marginTop: 0 }}>
                    <div>
                      <h2>{t("admin.sourceConflicts")} ({conflicts.filter(c => !c.resolvedAt).length} {t("admin.activeConflicts")})</h2>
                      <p className="muted">
                        {t("admin.quarantineHelp")}
                      </p>
                    </div>
                    <span className={`pill ${conflicts.some(c => !c.resolvedAt) ? "pill-crimson" : "pill-cyan"}`}>{t(conflicts.some(c => !c.resolvedAt) ? "admin.needsFix" : "admin.allResolved")}</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("admin.studentId")}</th>
                          <th>{t("admin.recordId")}</th>
                          <th>{t("admin.status")}</th>
                          <th>{t("admin.conflict")}</th>
                          <th>{t("admin.observed")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflicts.map((c) => (
                          <tr key={c.id}>
                            <td className="mono">{c.studentId || "—"}</td>
                            <td className="mono">{c.recordId || "—"}</td>
                            <td>{t(c.resolvedAt ? "admin.resolvedHistory" : "admin.activeConflicts")}</td>
                            <td
                              style={{
                                color: "var(--crimson)",
                                fontWeight: 600,
                              }}
                            >
                              {c.reason}
                            </td>
                            <td className="mono">
                              {new Date(c.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Audit Trail */}
              <section className="card">
                <div
                  className="section-head"
                  style={{ marginTop: 0, flexWrap: "wrap" }}
                >
                  <div>
                    <h2>{t("admin.audit")}</h2>
                    <p className="muted">
                      {t("admin.auditHelp")}
                    </p>
                  </div>
                  <div className="search-field" style={{ minWidth: 250 }}>
                    <Search size={16} />
                    <input
                      className="input"
                      aria-label={t("admin.filterAudit")}
                      placeholder={t("admin.filterAuditPlaceholder")}
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("admin.timestamp")}</th>
                        <th>{t("admin.action")}</th>
                        <th>{t("admin.actor")}</th>
                        <th>{t("admin.target")}</th>
                        <th>{t("admin.details")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td className="mono">
                            {new Date(ev.createdAt)
                              .toISOString()
                              .replace("T", " ")
                              .slice(0, 19)}
                          </td>
                          <td>
                            <span className="pill pill-blue">{ev.action}</span>
                          </td>
                          <td className="mono">{ev.actorId || "system"}</td>
                          <td className="mono">{ev.targetId || "—"}</td>
                          <td
                            className="mono"
                            style={{
                              maxWidth: 360,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {JSON.stringify(ev.detail)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* SLIDE-OVER / MODAL PASSPORT DETAIL INSPECTOR */}
          {(selectedPassport || loadingDetail) && (
            <div
              className="drawer-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={t("admin.inspector")}
            >
              <div className="drawer-panel">
                <div className="dialog-heading">
                  <div>
                    <span className="pill pill-blue">{t("admin.dossier")}</span>
                    <h2 style={{ marginTop: 8 }}>
                      {selectedPassport
                        ? `${selectedPassport.student.firstName} ${selectedPassport.student.lastName}`
                        : t("admin.inspectorLoading")}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("admin.closeInspector")}
                    onClick={() => setSelectedPassport(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                {selectedPassport && (
                  <div className="bento-stack">
                    <div className="passport-grid" style={{ marginTop: 0 }}>
                      <div className="identity-box">
                        <span className="mini-kicker">{t("admin.passportId")}</span>
                        <code className="mono">
                          {selectedPassport.publicId}
                        </code>
                      </div>
                      <div className="identity-box">
                        <span className="mini-kicker">{t("admin.studentId")}</span>
                        <code className="mono">
                          {selectedPassport.student.externalId}
                        </code>
                      </div>
                      <div className="identity-box">
                        <span className="mini-kicker">{t("admin.originalIssue")}</span>
                        <code className="mono">
                          {String(selectedPassport.initialIssueDate).slice(
                            0,
                            10,
                          )}
                        </code>
                      </div>
                    </div>

                    <div className="identity-box">
                      <span className="mini-kicker">
                        {t("admin.academicProfile")}
                      </span>
                      <div>
                        <b>{selectedPassport.student.program}</b> ·{" "}
                        {selectedPassport.student.educationLevel} ·{" "}
                        {selectedPassport.student.email}
                      </div>
                      {selectedPassport.student.identities.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 6,
                          }}
                        >
                          {selectedPassport.student.identities.map((id) => (
                            <span key={id.id} className="pill pill-cyan mono">
                              {id.role.toUpperCase()}: {id.subject}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">
                          {t("admin.noGoogleLinked")}
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: "12px 0 4px" }}>
                      Version History ({selectedPassport.versions.length})
                    </h3>
                    {selectedPassport.versions.map((ver) => {
                      const isLatest =
                        ver.number === selectedPassport.latestFinalizedVersion;
                      const isFinalized = Boolean(
                        ver.finalizedSlot && ver.storageKey,
                      );
                      return (
                        <section
                          key={ver.id}
                          className="card"
                          style={{ padding: 18 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <h4 style={{ margin: 0, fontSize: 17 }}>
                                Version {ver.number}
                              </h4>
                              <span
                                className={`pill ${
                                  isLatest
                                    ? "pill-cyan"
                                    : isFinalized
                                      ? "pill-pink"
                                      : "pill-blue"
                                }`}
                              >
                                {isLatest
                                  ? t("admin.latestFinalized")
                                  : isFinalized
                                    ? "SUPERSEDED"
                                    : ver.state}
                              </span>
                            </div>
                            <div className="page-actions">
                              <button
                                type="button"
                                className="button secondary btn-sm"
                                onClick={() =>
                                  setShareModal({
                                    passportId: selectedPassport.publicId,
                                    studentName: `${selectedPassport.student.firstName} ${selectedPassport.student.lastName}`,
                                    version: ver.number,
                                    code: ver.code,
                                    isLatest,
                                  })
                                }
                              >
                                <QrCode size={13} /> {t("admin.qrShare")}
                              </button>
                              <Link
                                className="button secondary btn-sm"
                                href={`/verify?code=${encodeURIComponent(ver.code)}`}
                              >
                                <ExternalLink size={13} /> {t("admin.verify")}
                              </Link>
                              {isFinalized && (
                                <a
                                  className="button btn-sm"
                                  href={`${API}/api/v1/admin/passports/${encodeURIComponent(selectedPassport.publicId)}/versions/${ver.number}/download`}
                                >
                                  <Download size={13} /> {t("admin.downloadPDF")}
                                </a>
                              )}
                            </div>
                          </div>

                          <div
                            className="muted mono"
                            style={{ marginTop: 8, fontSize: 11 }}
                          >
                            Code: {ver.code} · Pages: {ver.pageCount ?? "—"} ·
                            Awards: {ver.snapshot?.awards?.length ?? 0}
                          </div>
                          {ver.pdfSha256 && (
                            <div
                              className="muted mono"
                              style={{ fontSize: 10, marginTop: 4 }}
                            >
                              PDF SHA-256: {ver.pdfSha256}
                            </div>
                          )}
                          {ver.versionPda && (
                            <div
                              className="muted mono"
                              style={{ fontSize: 10, marginTop: 4 }}
                            >
                              Solana Devnet PDA: {ver.versionPda} (Slot{" "}
                              {ver.finalizedSlot})
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {shareModal && (
            <QrShareModal
              open={true}
              onClose={() => setShareModal(null)}
              passportId={shareModal.passportId}
              studentName={shareModal.studentName}
              version={shareModal.version}
              verificationCode={shareModal.code}
              isLatest={shareModal.isLatest}
            />
          )}
        </>
      )}
      <Dialog
        open={!!confirmation}
        title={confirmation?.title || t("admin.confirmOperation")}
        onClose={() => {
          if (!confirming) setConfirmation(null);
        }}
      >
        {confirmation && (
          <>
            <p>{confirmation.message}</p>
            <dl className="detail-list">
              {confirmation.details.map((detail) => (
                <div key={detail.label}>
                  <dt>{detail.label}</dt>
                  <dd className="mono">{detail.value}</dd>
                </div>
              ))}
            </dl>
            <div className="page-actions">
              <Button
                secondary
                onClick={() => setConfirmation(null)}
                disabled={confirming}
              >
                {t("admin.cancel")}
              </Button>
              <Button onClick={() => void confirmOperation()} busy={confirming}>
                {confirmation.label}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Shell>
  );
}
