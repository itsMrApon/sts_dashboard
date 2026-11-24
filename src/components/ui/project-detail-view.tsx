"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Edit2,
  Figma,
  FileText,
  Paperclip,
  Plus,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * A "case file" detail view: breadcrumb, a big title with a stamped status, a spec sheet of facts,
 * an optional progress strip, numbered tiles (attachments or sections) and a numbered task list.
 * The original props still work; items can also be links, carry their own icon and accent, and the
 * header actions can be replaced.
 */

// Type Definitions for Props
type Assignee = {
  name: string;
  avatarUrl?: string;
};

type ProjectTag = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

type Attachment = {
  name: string;
  /** Second line: a file size, or any short fact. */
  size: string;
  type: "pdf" | "figma" | "link";
  href?: string;
  icon?: LucideIcon;
  /** Tailwind text colour for the icon and number, e.g. "text-sky-400". */
  accent?: string;
};

type SubTaskStatus = "Completed" | "In Progress" | "Pending";

type SubTask = {
  id: number | string;
  task: string;
  category: string;
  status: SubTaskStatus;
  /** Shown instead of the status name (e.g. "New" for Pending). */
  statusLabel?: string;
  dueDate: string;
  href?: string;
};

type ProgressSegment = { label: string; count: number; tone: SubTaskStatus };

export type ProjectDetailViewProps = {
  breadcrumbs: { label: string; href: string }[];
  title: string;
  /** Small line above the title, e.g. "Batch of Nov 21". */
  eyebrow?: string;
  status: string;
  assignees: Assignee[];
  dateRange: {
    start: string;
    end: string;
  };
  tags: ProjectTag[];
  description: string;
  attachments: Attachment[];
  attachmentsTitle?: string;
  /** Hide the dashed "add" tile. */
  hideAddAttachment?: boolean;
  subTasks: SubTask[];
  subTasksTitle?: string;
  /** Shown in place of the table when there are no tasks. */
  emptyTasks?: React.ReactNode;
  /** One strip segment per item, coloured by tone. */
  progress?: ProgressSegment[];
  /** Replaces the share / edit / close buttons. */
  actions?: React.ReactNode;
  className?: string;
};

const TONE_DOT: Record<SubTaskStatus, string> = {
  Completed: "bg-emerald-400",
  "In Progress": "bg-amber-400",
  Pending: "bg-sky-400",
};

const TONE_TEXT: Record<SubTaskStatus, string> = {
  Completed: "text-emerald-400",
  "In Progress": "text-amber-400",
  Pending: "text-sky-400",
};

// Helper component for status badges
const StatusBadge = ({ status, label }: { status: SubTaskStatus; label?: string }) => (
  <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", TONE_TEXT[status])}>
    <span className={cn("size-1.5 rounded-full", TONE_DOT[status])} />
    {label ?? status}
  </span>
);

// Helper to get file icon
const FileIcon = ({ file }: { file: Attachment }) => {
  const className = cn("size-5", file.accent ?? "text-muted-foreground");
  if (file.icon) {
    const Icon = file.icon;
    return <Icon className={className} />;
  }
  if (file.type === "pdf") return <FileText className={cn("size-5", file.accent ?? "text-red-500")} />;
  if (file.type === "figma") return <Figma className={cn("size-5", file.accent ?? "text-purple-500")} />;
  return <Paperclip className={className} />;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** The rubber-stamp status next to a title. */
export function DetailStamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex -rotate-3 items-center gap-2 rounded-md border-2 border-amber-400/70 px-3 py-1 font-mono text-xs font-bold tracking-[0.2em] text-amber-300 uppercase",
        className,
      )}
    >
      <span className="size-2 animate-pulse rounded-full bg-amber-400" />
      {children}
    </span>
  );
}

/** Mono breadcrumb: every crumb but the last is a link. */
export function DetailBreadcrumbs({ items }: { items: { label: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center font-mono text-xs text-muted-foreground">
      {items.map((breadcrumb, index) => (
        <React.Fragment key={`${breadcrumb.label}-${index}`}>
          {index < items.length - 1 ? (
            <Link href={breadcrumb.href} className="truncate hover:text-foreground">
              {breadcrumb.label}
            </Link>
          ) : (
            <span className="truncate text-foreground">{breadcrumb.label}</span>
          )}
          {index < items.length - 1 && <span className="mx-2 text-border">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** A label / value pair on the spec sheet. */
export function DetailFact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { y: 14, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 140, damping: 20 } },
};

export function ProjectDetailView({
  breadcrumbs,
  title,
  eyebrow,
  status,
  assignees,
  dateRange,
  tags,
  description,
  attachments,
  attachmentsTitle = "Attachment",
  hideAddAttachment = false,
  subTasks,
  subTasksTitle = "Task List",
  emptyTasks,
  progress,
  actions,
  className,
}: ProjectDetailViewProps) {
  const progressTotal = progress?.reduce((sum, segment) => sum + segment.count, 0) ?? 0;

  return (
    <motion.article
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={cn("mx-auto w-full max-w-5xl", className)}
    >
      {/* Header: breadcrumb and actions */}
      <motion.header
        variants={itemVariants}
        className="flex items-center justify-between gap-3 border-b border-dashed border-border/70 pb-3"
      >
        <DetailBreadcrumbs items={breadcrumbs} />
        <div className="flex shrink-0 items-center gap-1">
          {actions ?? (
            <>
              <Button variant="ghost" size="icon" aria-label="Share">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Edit">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </motion.header>

      {/* Title with a stamped status */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-7">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="text-3xl leading-[1.05] font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
            {title}
          </h1>
        </div>
        <DetailStamp>{status}</DetailStamp>
      </motion.div>

      {/* Progress strip: one segment per item */}
      {progress && progressTotal > 0 ? (
        <motion.div variants={itemVariants} className="mt-6 space-y-2">
          <div className="flex h-2 gap-1" role="img" aria-label={progress.map((s) => `${s.count} ${s.label}`).join(", ")}>
            {progress.flatMap((segment) =>
              Array.from({ length: segment.count }, (_, index) => (
                <span key={`${segment.label}-${index}`} className={cn("flex-1 rounded-full", TONE_DOT[segment.tone])} />
              )),
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            {progress.map((segment) => (
              <span key={segment.label} className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", TONE_DOT[segment.tone])} />
                {segment.count} {segment.label}
              </span>
            ))}
          </div>
        </motion.div>
      ) : null}

      {/* Spec sheet */}
      <motion.div
        variants={itemVariants}
        className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border/60 py-6 lg:grid-cols-4"
      >
        <DetailFact label="Owner">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {assignees.map((assignee) => (
              <span key={assignee.name} className="inline-flex items-center gap-2">
                <Avatar className="size-6">
                  {assignee.avatarUrl ? <AvatarImage src={assignee.avatarUrl} alt={assignee.name} /> : null}
                  <AvatarFallback className="text-[10px]">{assignee.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{assignee.name}</span>
              </span>
            ))}
          </div>
        </DetailFact>
        <DetailFact label="Dates">
          <p className="flex items-center gap-2 font-medium">
            {dateRange.start}
            <ArrowRight className="size-3.5 text-muted-foreground" />
            {dateRange.end}
          </p>
        </DetailFact>
        <DetailFact label="Tags" className="col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag.label} variant={tag.variant} className="rounded-full">
                {tag.label}
              </Badge>
            ))}
          </div>
        </DetailFact>
        <DetailFact label="Summary" className="col-span-2 lg:col-span-4">
          <p className="max-w-3xl text-base leading-relaxed text-foreground/80">{description}</p>
        </DetailFact>
      </motion.div>

      {/* Numbered tiles */}
      <motion.section variants={itemVariants} className="mt-8 space-y-3">
        <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {attachmentsTitle}
          <span className="text-foreground">{pad(attachments.length)}</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {attachments.map((file, index) => {
            const body = (
              <>
                <div className="flex items-start justify-between">
                  <span className={cn("font-mono text-xs", file.accent ?? "text-muted-foreground")}>{pad(index + 1)}</span>
                  {file.href ? (
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                  ) : null}
                </div>
                <div className="mt-6 flex items-center gap-2.5">
                  <FileIcon file={file} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
              </>
            );
            const tileClass =
              "group block rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
            return file.href ? (
              <Link key={file.name} href={file.href} className={tileClass}>
                {body}
              </Link>
            ) : (
              <div key={file.name} className={tileClass}>
                {body}
              </div>
            );
          })}
          {hideAddAttachment ? null : (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed p-3 transition-colors hover:bg-muted/40">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
      </motion.section>

      {/* Numbered task list */}
      <motion.section variants={itemVariants} className="mt-8 space-y-3 pb-6">
        <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {subTasksTitle}
          <span className="text-foreground">{pad(subTasks.length)}</span>
        </h2>
        {subTasks.length === 0 && emptyTasks ? (
          <div className="rounded-xl bg-muted/30 p-6 text-sm text-muted-foreground">{emptyTasks}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-12 font-mono text-[10px] tracking-[0.18em] uppercase">No</TableHead>
                <TableHead className="font-mono text-[10px] tracking-[0.18em] uppercase">Task</TableHead>
                <TableHead className="hidden font-mono text-[10px] tracking-[0.18em] uppercase sm:table-cell">Category</TableHead>
                <TableHead className="font-mono text-[10px] tracking-[0.18em] uppercase">Status</TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-[0.18em] uppercase">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subTasks.map((task, index) => (
                <motion.tr
                  variants={itemVariants}
                  key={task.id}
                  className="group border-b border-border/40 transition-colors hover:bg-muted/40"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{pad(index + 1)}</TableCell>
                  <TableCell className="max-w-0 font-medium sm:max-w-none">
                    {task.href ? (
                      <Link href={task.href} className="inline-flex max-w-full items-center gap-1.5 hover:underline">
                        <span className="truncate">{task.task}</span>
                        <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    ) : (
                      task.task
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{task.category}</TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} label={task.statusLabel} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.dueDate}</TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.section>
    </motion.article>
  );
}

export default ProjectDetailView;
