import {
  describeBoardTaskActivityLabel,
  formatBoardTaskActivityTaskLabel,
} from '@shared/utils/boardTaskActivityLabels';
import {
  describeBoardTaskActivityActorLabel,
  describeBoardTaskActivityContextLines,
} from '@shared/utils/boardTaskActivityPresentation';

import { BoardTaskActivityRecordSource } from './BoardTaskActivityRecordSource';
import { BoardTaskExactLogChunkBuilder } from '../exact/BoardTaskExactLogChunkBuilder';
import { BoardTaskExactLogDetailSelector } from '../exact/BoardTaskExactLogDetailSelector';
import { BoardTaskExactLogStrictParser } from '../exact/BoardTaskExactLogStrictParser';

import type { BoardTaskActivityRecord } from './BoardTaskActivityRecord';
import type {
  BoardTaskActivityDetail,
  BoardTaskActivityDetailMetadataRow,
  BoardTaskActivityDetailResult,
} from '@shared/types';
import type { BoardTaskExactLogBundleCandidate } from '../exact/BoardTaskExactLogTypes';

function scopeLabel(record: BoardTaskActivityRecord): string {
  switch (record.actorContext.relation) {
    case 'same_task':
      return 'same task';
    case 'other_active_task':
      return 'other active task';
    case 'idle':
      return 'idle';
    case 'ambiguous':
      return 'ambiguous';
    default:
      return record.actorContext.relation;
  }
}

function formatTaskLabelOrLocator(record: BoardTaskActivityRecord['task']): string {
  return formatBoardTaskActivityTaskLabel(record) ?? `#${record.locator.ref}`;
}

function relationshipValue(record: BoardTaskActivityRecord): string | null {
  const relationship = record.action?.details?.relationship;
  const peerTaskLabel = formatBoardTaskActivityTaskLabel(record.action?.peerTask);

  if (relationship && peerTaskLabel) {
    return `${relationship} ${peerTaskLabel}`;
  }
  if (relationship) {
    return relationship;
  }
  if (peerTaskLabel) {
    return peerTaskLabel;
  }
  return null;
}

function buildMetadataRows(record: BoardTaskActivityRecord): BoardTaskActivityDetailMetadataRow[] {
  const rows: BoardTaskActivityDetailMetadataRow[] = [
    {
      label: 'Task',
      value: formatTaskLabelOrLocator(record.task),
    },
    {
      label: 'Scope',
      value: scopeLabel(record),
    },
  ];

  if (record.action?.canonicalToolName) {
    rows.push({ label: 'Tool', value: record.action.canonicalToolName });
  }
  if (record.action?.details?.status) {
    rows.push({ label: 'Status', value: record.action.details.status });
  }
  if ('owner' in (record.action?.details ?? {})) {
    rows.push({ label: 'Owner', value: record.action?.details?.owner ?? 'cleared' });
  }
  if ('clarification' in (record.action?.details ?? {})) {
    rows.push({
      label: 'Clarification',
      value: record.action?.details?.clarification ?? 'cleared',
    });
  }
  if (record.action?.details?.reviewer) {
    rows.push({ label: 'Reviewer', value: record.action.details.reviewer });
  }
  if (record.action?.details?.commentId) {
    rows.push({ label: 'Comment', value: record.action.details.commentId });
  }
  if (record.action?.details?.attachmentId) {
    rows.push({ label: 'Attachment ID', value: record.action.details.attachmentId });
  }
  if (record.action?.details?.filename) {
    rows.push({ label: 'File', value: record.action.details.filename });
  }
  const relationship = relationshipValue(record);
  if (relationship) {
    rows.push({ label: 'Relationship', value: relationship });
  }
  const activeTaskLabel = formatBoardTaskActivityTaskLabel(record.actorContext.activeTask);
  if (activeTaskLabel) {
    rows.push({ label: 'Active task', value: activeTaskLabel });
  }
  if (record.actorContext.activePhase) {
    rows.push({ label: 'Phase', value: record.actorContext.activePhase });
  }

  return rows;
}

function buildCandidate(record: BoardTaskActivityRecord): BoardTaskExactLogBundleCandidate {
  return {
    id: `activity:${record.id}`,
    timestamp: record.timestamp,
    actor: record.actor,
    source: {
      filePath: record.source.filePath,
      messageUuid: record.source.messageUuid,
      ...(record.source.toolUseId ? { toolUseId: record.source.toolUseId } : {}),
      sourceOrder: record.source.sourceOrder,
    },
    records: [record],
    anchor: record.source.toolUseId
      ? {
          kind: 'tool',
          filePath: record.source.filePath,
          messageUuid: record.source.messageUuid,
          toolUseId: record.source.toolUseId,
        }
      : {
          kind: 'message',
          filePath: record.source.filePath,
          messageUuid: record.source.messageUuid,
        },
    actionLabel: describeBoardTaskActivityLabel(record),
    ...(record.action?.category ? { actionCategory: record.action.category } : {}),
    ...(record.action?.canonicalToolName
      ? { canonicalToolName: record.action.canonicalToolName }
      : {}),
    linkKinds: [record.linkKind],
    targetRoles: [record.targetRole],
    canLoadDetail: false,
  };
}

export class BoardTaskActivityDetailService {
  constructor(
    private readonly recordSource: BoardTaskActivityRecordSource = new BoardTaskActivityRecordSource(),
    private readonly strictParser: BoardTaskExactLogStrictParser = new BoardTaskExactLogStrictParser(),
    private readonly detailSelector: BoardTaskExactLogDetailSelector = new BoardTaskExactLogDetailSelector(),
    private readonly chunkBuilder: BoardTaskExactLogChunkBuilder = new BoardTaskExactLogChunkBuilder()
  ) {}

  async getTaskActivityDetail(
    teamName: string,
    taskId: string,
    activityId: string
  ): Promise<BoardTaskActivityDetailResult> {
    const records = await this.recordSource.getTaskRecords(teamName, taskId);
    const record = records.find((candidate) => candidate.id === activityId);
    if (!record) {
      return { status: 'missing' };
    }

    const detail: BoardTaskActivityDetail = {
      entryId: record.id,
      summaryLabel: describeBoardTaskActivityLabel(record),
      actorLabel: describeBoardTaskActivityActorLabel(record.actor),
      timestamp: record.timestamp,
      contextLines: describeBoardTaskActivityContextLines(record),
      metadataRows: buildMetadataRows(record),
    };

    if (record.source.toolUseId) {
      const parsedMessagesByFile = await this.strictParser.parseFiles([record.source.filePath]);
      const detailCandidate = this.detailSelector.selectDetail({
        candidate: buildCandidate(record),
        records,
        parsedMessagesByFile,
      });

      if (detailCandidate) {
        const chunks = this.chunkBuilder.buildBundleChunks(detailCandidate.filteredMessages);
        if (chunks.length > 0) {
          detail.logDetail = {
            id: detailCandidate.id,
            chunks,
          };
        }
      }
    }

    return {
      status: 'ok',
      detail,
    };
  }
}
