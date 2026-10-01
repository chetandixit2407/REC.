import { dbService } from './db.ts';
import type {
  Candidate,
  Interview,
  Notification,
  PantryTask,
  TimelineEvent,
  AuditLog,
  UserRole,
  StaffSession,
  DomainEvent,
  DomainEventType,
  CandidateResumeMetadata,
} from '../types/index.ts';

// SSE client subscriber interface with verified staff session
export interface SSEClient {
  id: string;
  session: StaffSession;
  role: UserRole;
  userId: string;
  res: any;
  connectedAt: string;
  lastPing: number;
}

class EventWorkflowEngine {
  private sseClients: Map<string, SSEClient> = new Map();

  public subscribeClient(client: SSEClient) {
    this.sseClients.set(client.id, client);
    console.log(
      `[REALTIME] connection opened & authenticated: ${client.id} | User: ${client.session.name} (${client.userId}) | Role: ${client.role}`
    );
  }

  public unsubscribeClient(clientId: string) {
    const client = this.sseClients.get(clientId);
    if (client) {
      console.log(
        `[REALTIME] connection closed: ${clientId} | User: ${client.session.name} (${client.userId})`
      );
      this.sseClients.delete(clientId);
    }
  }

  public getConnectedClientsCount(): number {
    return this.sseClients.size;
  }

  /**
   * Broadcast helper that delegates to publishDomainEvent
   */
  public broadcast(event: {
    type: string;
    payload?: any;
    targetRoles?: UserRole[];
    targetUserId?: string;
  }) {
    return this.publishDomainEvent({
      eventType: event.type as DomainEventType,
      candidateId: event.payload?.candidateId,
      visitId: event.payload?.visitId,
      applicationId: event.payload?.applicationId,
      interviewId: event.payload?.interviewId,
      roomId: event.payload?.roomId,
      taskId: event.payload?.taskId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      targetRoles: event.targetRoles,
      targetUserId: event.targetUserId,
      metadata: event.payload,
    });
  }

  /**
   * Authoritative Domain Event Publisher with Database Persistence & Role-Based Filtering
   */
  public publishDomainEvent(eventData: {
    eventType: DomainEventType;
    candidateId?: string;
    visitId?: string;
    applicationId?: string;
    interviewId?: string;
    roomId?: string;
    taskId?: string;
    registrationSessionId?: string;
    actorType: 'SYSTEM' | 'CANDIDATE' | 'STAFF' | 'USER';
    source: 'CANDIDATE_REGISTRATION' | 'STAFF_ACTION' | 'WORKFLOW_ENGINE';
    targetRoles?: UserRole[];
    targetUserId?: string;
    metadata?: Record<string, any>;
  }): DomainEvent {
    const timestamp = new Date().toISOString();
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const domainEvent: DomainEvent = {
      eventId,
      eventType: eventData.eventType,
      candidateId: eventData.candidateId,
      visitId: eventData.visitId || eventData.candidateId,
      applicationId: eventData.applicationId || eventData.candidateId,
      interviewId: eventData.interviewId,
      roomId: eventData.roomId,
      taskId: eventData.taskId,
      registrationSessionId: eventData.registrationSessionId,
      timestamp,
      actorType: eventData.actorType,
      source: eventData.source,
      targetRoles: eventData.targetRoles,
      targetUserId: eventData.targetUserId,
      metadata: eventData.metadata || {},
    };

    console.log(`[EVENT] event created: ${domainEvent.eventType} | ID: ${domainEvent.eventId}`);

    // Persist event into database domainEvents ring-buffer
    try {
      dbService.update((draft) => {
        draft.domainEvents = draft.domainEvents || [];
        draft.domainEvents.unshift(domainEvent);
        // Keep last 1000 domain events in persistence
        if (draft.domainEvents.length > 1000) {
          draft.domainEvents = draft.domainEvents.slice(0, 1000);
        }
      });
      console.log(`[EVENT] event persisted: ${domainEvent.eventId} to authoritative storage`);
    } catch (err) {
      console.error(`[EVENT] Failed persisting domain event ${domainEvent.eventId}`, err);
    }

    // Deliver to connected authenticated staff SSE clients
    let deliveredCount = 0;
    for (const [id, client] of this.sseClients.entries()) {
      // 1. Target user filter
      if (domainEvent.targetUserId && client.userId && client.userId !== domainEvent.targetUserId) {
        continue;
      }

      // 2. Target roles filter
      if (domainEvent.targetRoles && !domainEvent.targetRoles.includes(client.role)) {
        continue;
      }

      // 3. Role authorization check: Pantry must NEVER receive candidate confidential profile data
      if (client.role === 'PANTRY' && domainEvent.eventType === 'CANDIDATE_FORM_SUBMITTED') {
        // Pantry does not receive raw candidate intake events
        continue;
      }

      // Format role-safe sanitized payload
      const sanitizedPayload: any = {
        eventId: domainEvent.eventId,
        eventType: domainEvent.eventType,
        candidateId: domainEvent.candidateId,
        visitId: domainEvent.visitId,
        applicationId: domainEvent.applicationId,
        interviewId: domainEvent.interviewId,
        roomId: domainEvent.roomId,
        taskId: domainEvent.taskId,
        registrationSessionId: domainEvent.registrationSessionId,
        timestamp: domainEvent.timestamp,
        actorType: domainEvent.actorType,
        source: domainEvent.source,
        metadata: { ...domainEvent.metadata },
      };

      // Strip sensitive details if delivering to Reception or Pantry
      if (client.role === 'RECEPTION' || client.role === 'PANTRY') {
        if (sanitizedPayload.metadata) {
          delete sanitizedPayload.metadata.salary;
          delete sanitizedPayload.metadata.expectedSalary;
          delete sanitizedPayload.metadata.hrNotes;
          delete sanitizedPayload.metadata.hrPrivateNotes;
          delete sanitizedPayload.metadata.governmentIdNumber;
        }
      }

      const sseMessage = `data: ${JSON.stringify({ type: domainEvent.eventType, payload: sanitizedPayload, eventId: domainEvent.eventId, timestamp: domainEvent.timestamp })}\n\n`;

      try {
        client.res.write(sseMessage);
        deliveredCount++;
        console.log(
          `[DASHBOARD] recipient resolved: ${client.session.name} (${client.role}) | event delivered: ${domainEvent.eventId}`
        );
      } catch (err) {
        console.error(`[DASHBOARD] Failed delivering event to client ${id}`, err);
        this.sseClients.delete(id);
      }
    }

    console.log(
      `[EVENT] event published: ${domainEvent.eventType} (${domainEvent.eventId}) -> delivered to ${deliveredCount} active dashboards`
    );

    return domainEvent;
  }

  /**
   * Resync missed events for reconnected clients
   */
  public getMissedEvents(
    sinceTimestamp?: string,
    lastEventId?: string,
    role: UserRole = 'HR'
  ): DomainEvent[] {
    const db = dbService.get();
    const events = db.domainEvents || [];
    if (!events.length) return [];

    let filtered = events;

    if (sinceTimestamp) {
      const sinceTime = new Date(sinceTimestamp).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() > sinceTime);
    } else if (lastEventId) {
      const idx = filtered.findIndex((e) => e.eventId === lastEventId);
      if (idx !== -1) {
        filtered = filtered.slice(0, idx);
      }
    } else {
      // Default return latest 50
      filtered = filtered.slice(0, 50);
    }

    // Role filter
    return filtered.filter((e) => {
      if (e.targetRoles && !e.targetRoles.includes(role)) return false;
      if (role === 'PANTRY' && e.eventType === 'CANDIDATE_FORM_SUBMITTED') return false;
      return true;
    });
  }

  // 1. CANDIDATE ARRIVAL & CHECK-IN EVENT
  public handleCandidateCheckIn(candidate: Candidate, interview?: Interview, checkInSessionToken?: string) {
    const timestamp = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Step A: Generate Role-Based Notifications
    const notificationsToCreate: Notification[] = [];

    // HR Notification: FULL dossier
    notificationsToCreate.push({
      id: `notif-${Date.now()}-hr`,
      recipientRole: 'HR',
      title: 'New Candidate Checked In',
      message: `${candidate.fullName} has arrived for ${candidate.position} (${interview?.roundName || 'Interview'}). Scheduled: ${interview?.scheduledTime || 'Walk-in'}.`,
      priority: 'HIGH',
      eventType: 'CANDIDATE_ARRIVED',
      entityId: candidate.id,
      entityType: 'CANDIDATE',
      read: false,
      createdAt: timestamp,
      actionButtons: [
        { label: 'Assign Room', actionKey: 'ASSIGN_ROOM', payload: { candidateId: candidate.id, interviewId: interview?.id } },
        { label: 'View Profile', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candidate.id } },
      ],
      payload: {
        candidateName: candidate.fullName,
        position: candidate.position,
        stage: interview?.roundName || 'Round 1',
        interviewer: interview?.interviewerName || 'Unassigned',
        scheduled: interview?.scheduledTime || 'N/A',
        arrived: timeFormatted,
        phone: candidate.phone,
        email: candidate.email,
        experience: candidate.totalExperience,
        currentLocation: candidate.currentLocation,
        hasPhoto: !!candidate.livePhoto,
        hasResume: !!candidate.resumeUrl,
        livePhoto: candidate.livePhoto,
        resumeFileName: candidate.resumeFileName,
      },
    });

    // ADMIN Notification: Full operational
    notificationsToCreate.push({
      id: `notif-${Date.now()}-admin`,
      recipientRole: 'ADMIN',
      title: 'Candidate Checked In',
      message: `${candidate.fullName} checked in for ${candidate.position}. Status: Waiting in Reception.`,
      priority: 'HIGH',
      eventType: 'CANDIDATE_ARRIVED',
      entityId: candidate.id,
      entityType: 'CANDIDATE',
      read: false,
      createdAt: timestamp,
      actionButtons: [
        { label: 'View Record', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candidate.id } },
      ],
      payload: {
        candidateName: candidate.fullName,
        position: candidate.position,
        interviewer: interview?.interviewerName || 'Unassigned',
        arrived: timeFormatted,
        currentLocation: candidate.currentLocation,
        room: 'Not Assigned',
        photoAvailable: !!candidate.livePhoto,
        resumeAvailable: !!candidate.resumeUrl,
      },
    });

    // CEO Notification: Executive brief
    notificationsToCreate.push({
      id: `notif-${Date.now()}-ceo`,
      recipientRole: 'CEO',
      title: 'Candidate Arrived for Interview',
      message: `${candidate.fullName} (${candidate.position}) is in reception for ${interview?.roundName || 'Assessment'}.`,
      priority: 'NORMAL',
      eventType: 'CANDIDATE_ARRIVED',
      entityId: candidate.id,
      entityType: 'CANDIDATE',
      read: false,
      createdAt: timestamp,
      actionButtons: [
        { label: 'Executive Profile', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candidate.id } },
      ],
      payload: {
        candidateName: candidate.fullName,
        position: candidate.position,
        stage: interview?.roundName || 'Round 1',
        interviewer: interview?.interviewerName || 'Interview Panel',
        scheduled: interview?.scheduledTime || 'Today',
        arrived: timeFormatted,
        currentStatus: 'Waiting in Reception',
      },
    });

    // CO-FOUNDER Notification
    notificationsToCreate.push({
      id: `notif-${Date.now()}-cofounder`,
      recipientRole: 'CO_FOUNDER',
      title: 'Candidate Arrived for Interview',
      message: `${candidate.fullName} (${candidate.position}) checked in at Reception.`,
      priority: 'NORMAL',
      eventType: 'CANDIDATE_ARRIVED',
      entityId: candidate.id,
      entityType: 'CANDIDATE',
      read: false,
      createdAt: timestamp,
      actionButtons: [
        { label: 'View Profile', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candidate.id } },
      ],
      payload: {
        candidateName: candidate.fullName,
        position: candidate.position,
        stage: interview?.roundName || 'Round 1',
        interviewer: interview?.interviewerName || 'Interview Panel',
        arrived: timeFormatted,
      },
    });

    // ASSIGNED INTERVIEWER Notification
    if (interview?.interviewerId) {
      notificationsToCreate.push({
        id: `notif-${Date.now()}-intv`,
        recipientRole: 'INTERVIEWER',
        recipientUserId: interview.interviewerId,
        title: 'Your Candidate Has Arrived',
        message: `${candidate.fullName} has arrived for ${interview.roundName}. Waiting in Reception area.`,
        priority: 'HIGH',
        eventType: 'CANDIDATE_WAITING',
        entityId: candidate.id,
        entityType: 'INTERVIEW',
        read: false,
        createdAt: timestamp,
        actionButtons: [
          { label: 'View Candidate', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candidate.id } },
          { label: 'Start Interview', actionKey: 'START_INTERVIEW', payload: { interviewId: interview.id } },
        ],
        payload: {
          candidateName: candidate.fullName,
          position: candidate.position,
          stage: interview.roundName,
          arrived: timeFormatted,
          currentLocation: 'Waiting Area',
          room: 'Awaiting HR Room Assignment',
          experience: candidate.totalExperience,
          relevantExperience: candidate.relevantExperience,
          livePhoto: candidate.livePhoto,
        },
      });
    }

    // RECEPTION Notification: Operational assist
    notificationsToCreate.push({
      id: `notif-${Date.now()}-rec`,
      recipientRole: 'RECEPTION',
      title: 'Candidate Arrived at Front Desk',
      message: `${candidate.fullName} checked in for ${candidate.position}. Direct to Waiting Lounge.`,
      priority: 'HIGH',
      eventType: 'CANDIDATE_ARRIVED',
      entityId: candidate.id,
      entityType: 'CANDIDATE',
      read: false,
      createdAt: timestamp,
      actionButtons: [
        { label: 'Assist Candidate', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candidate.id } },
      ],
      payload: {
        candidateName: candidate.fullName,
        position: candidate.position,
        interviewer: interview?.interviewerName || 'Interviewer',
        status: 'Waiting in Lounge',
        action: 'Guide candidate to waiting area lounge and offer comfort',
        arrived: timeFormatted,
        livePhoto: candidate.livePhoto,
      },
    });

    // Step B: Update Database & Timeline
    dbService.update((draft) => {
      draft.notifications.unshift(...notificationsToCreate);

      draft.timelineEvents.unshift(
        {
          id: `tl-${Date.now()}-submit`,
          candidateId: candidate.id,
          timestamp,
          actorType: 'USER',
          actorName: candidate.fullName,
          eventType: 'CANDIDATE_FORM_SUBMITTED',
          description: `Candidate completed self-check-in with live photo and resume verification.`,
        },
        {
          id: `tl-${Date.now()}-alerts`,
          candidateId: candidate.id,
          timestamp,
          actorType: 'SYSTEM',
          actorName: 'Workflow Engine',
          eventType: 'ROLE_BASED_ALERTS_DISPATCHED',
          description: `Dispatched automated arrival alerts to HR, Interviewer (${interview?.interviewerName || 'Team'}), Admin, CEO, and Reception.`,
        }
      );

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'SYSTEM',
        actorName: 'Self-CheckIn Engine',
        action: 'CANDIDATE_CHECKED_IN',
        details: `Candidate ${candidate.fullName} (${candidate.id}) arrived via QR token ${checkInSessionToken || 'N/A'}. Persisted to DB.`,
        entityId: candidate.id,
        entityType: 'CANDIDATE',
      });
    });

    // Step C: Real-time broadcast
    this.publishDomainEvent({
      eventType: 'CANDIDATE_ARRIVED',
      candidateId: candidate.id,
      interviewId: interview?.id,
      registrationSessionId: checkInSessionToken,
      actorType: 'CANDIDATE',
      source: 'CANDIDATE_REGISTRATION',
      targetRoles: ['HR', 'ADMIN', 'CEO', 'CO_FOUNDER', 'INTERVIEWER', 'RECEPTION'],
      metadata: {
        candidateName: candidate.fullName,
        position: candidate.position,
        department: candidate.department,
        status: candidate.status,
        currentLocation: candidate.currentLocation,
        arrivalTime: timestamp,
      },
    });
  }

  // 2. ROOM ASSIGNMENT BY HR
  public handleRoomAssigned(
    hrUserId: string,
    hrName: string,
    candidateId: string,
    interviewId: string,
    roomId: string
  ) {
    const timestamp = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let candidateName = '';
    let roomName = '';
    let interviewerId = '';
    let interviewerName = '';
    let position = '';
    let pantryTaskId = '';

    dbService.update((draft) => {
      const room = draft.rooms.find((r) => r.id === roomId);
      const cand = draft.candidates.find((c) => c.id === candidateId);
      const intv = draft.interviews.find((i) => i.id === interviewId);

      if (!room || !cand) {
        throw new Error('Room or Candidate not found');
      }

      if (room.isActive === false) {
        throw new Error(`Cannot assign: "${room.name}" is currently deactivated.`);
      }

      // Backend Double-Booking Protection:
      if (
        (room.status === 'OCCUPIED' || room.status === 'ASSIGNED') &&
        room.currentCandidateId &&
        room.currentCandidateId !== candidateId
      ) {
        throw new Error(
          `Double-booking prevented: "${room.name}" is currently occupied by ${room.currentCandidateName || 'another candidate'}. Please select another room.`
        );
      }

      // Vacate candidate's previously assigned room if any
      const previousRoom = draft.rooms.find(
        (r) => r.id !== roomId && r.currentCandidateId === candidateId
      );
      if (previousRoom) {
        previousRoom.status = 'AVAILABLE';
        previousRoom.currentCandidateId = undefined;
        previousRoom.currentCandidateName = undefined;
        previousRoom.currentInterviewId = undefined;
        previousRoom.assignedInterviewerName = undefined;
        previousRoom.updatedAt = timestamp;
      }

      candidateName = cand.fullName;
      roomName = room.name;
      position = cand.position;
      interviewerId = intv?.interviewerId || '';
      interviewerName = intv?.interviewerName || 'Interviewer';

      // 1. Reserve Room
      room.status = 'ASSIGNED';
      room.currentCandidateId = cand.id;
      room.currentCandidateName = cand.fullName;
      room.currentInterviewId = intv?.id;
      room.assignedInterviewerName = interviewerName;
      room.updatedAt = timestamp;

      // 2. Update Candidate Location & Status
      cand.currentLocation = room.name;
      cand.status = 'ROOM_ASSIGNED';

      // 3. Update Interview Record
      if (intv) {
        intv.roomId = room.id;
        intv.roomName = room.name;
        intv.status = 'ROOM_ASSIGNED';
      }

      // 4. Automatically create Pantry Preparation Task
      if (draft.settings.autoAssignPantryOnRoom) {
        pantryTaskId = `pantry-task-${Date.now()}`;
        const pantryTask: PantryTask = {
          id: pantryTaskId,
          roomId: room.id,
          roomName: room.name,
          candidateName: cand.fullName,
          taskType: 'ROOM_PREP',
          description: `Prepare ${room.name}: Sanitization, setup, and 2 bottles of premium mineral water.`,
          requiredItems: ['2x Bottled Mineral Water', 'Room Setup & Lights Check', 'Whiteboard markers'],
          priority: 'HIGH',
          status: 'PENDING',
          createdAt: timestamp,
        };
        draft.pantryTasks.unshift(pantryTask);

        // PANTRY ALERT: WHAT, WHERE, WHEN (No confidential data!)
        draft.notifications.unshift({
          id: `notif-${Date.now()}-pan`,
          recipientRole: 'PANTRY',
          title: 'Room Hospitality Preparation',
          message: `Task: Prepare ${room.name} for interview. Required: Water + Room Preparation. Time: ${timeFormatted}.`,
          priority: 'HIGH',
          eventType: 'ROOM_PREPARATION_REQUIRED',
          entityId: pantryTask.id,
          entityType: 'PANTRY_TASK',
          read: false,
          createdAt: timestamp,
          actionButtons: [
            { label: 'Mark Complete', actionKey: 'COMPLETE_PANTRY_TASK', payload: { taskId: pantryTask.id } },
          ],
          payload: {
            task: 'Prepare Room',
            room: room.name,
            candidate: cand.fullName,
            time: timeFormatted,
            required: 'Water + Room Preparation',
          },
        });
      }

      // 5. Notify Interviewer: Room assigned
      draft.notifications.unshift({
        id: `notif-${Date.now()}-intv-room`,
        recipientRole: 'INTERVIEWER',
        recipientUserId: interviewerId,
        title: `Room Assigned: ${room.name}`,
        message: `${cand.fullName} has been assigned to ${room.name}. You may proceed to start the interview.`,
        priority: 'HIGH',
        eventType: 'ROOM_ASSIGNED',
        entityId: intv?.id || cand.id,
        entityType: 'INTERVIEW',
        read: false,
        createdAt: timestamp,
        actionButtons: [
          { label: 'Start Interview', actionKey: 'START_INTERVIEW', payload: { interviewId: intv?.id } },
        ],
        payload: {
          candidate: cand.fullName,
          room: room.name,
          stage: intv?.roundName,
          status: 'Ready in Room',
        },
      });

      // 6. Notify Reception: Guide candidate
      draft.notifications.unshift({
        id: `notif-${Date.now()}-rec-guide`,
        recipientRole: 'RECEPTION',
        title: 'Escort Candidate to Room',
        message: `Escort ${cand.fullName} to ${room.name} for interview with ${interviewerName}.`,
        priority: 'NORMAL',
        eventType: 'ROOM_ASSIGNED',
        entityId: cand.id,
        entityType: 'CANDIDATE',
        read: false,
        createdAt: timestamp,
        payload: {
          candidate: cand.fullName,
          room: room.name,
          interviewer: interviewerName,
          action: `Guide candidate to ${room.name}`,
        },
      });

      // 7. Timeline events
      draft.timelineEvents.unshift(
        {
          id: `tl-${Date.now()}-hr-room`,
          candidateId: cand.id,
          timestamp,
          actorType: 'USER',
          actorName: hrName,
          eventType: 'ROOM_ASSIGNED_BY_HR',
          description: `HR assigned ${room.name} to candidate ${cand.fullName}.`,
        },
        {
          id: `tl-${Date.now()}-sys-pantry`,
          candidateId: cand.id,
          timestamp,
          actorType: 'SYSTEM',
          actorName: 'Workflow Engine',
          eventType: 'PANTRY_TASK_AUTOMATED',
          description: `Automated hospitality task generated for Pantry to prepare ${room.name} with water & room setup.`,
        }
      );

      // 8. Audit log
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'USER',
        actorName: hrName,
        actorRole: 'HR',
        action: 'ASSIGN_ROOM',
        details: `Assigned room ${room.name} (${room.id}) to candidate ${cand.fullName} (${cand.id}). Automated downstream workflow tasks.`,
        entityId: room.id,
        entityType: 'ROOM',
      });
    });

    // Broadcast Real-time Domain Event
    this.publishDomainEvent({
      eventType: 'ROOM_ASSIGNED',
      candidateId,
      interviewId,
      roomId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      metadata: {
        candidateName,
        roomId,
        roomName,
        interviewerId,
        interviewerName,
        status: 'ROOM_ASSIGNED',
      },
    });

    if (pantryTaskId) {
      this.publishDomainEvent({
        eventType: 'PANTRY_TASK_CREATED',
        taskId: pantryTaskId,
        roomId,
        candidateId,
        actorType: 'SYSTEM',
        source: 'WORKFLOW_ENGINE',
        targetRoles: ['PANTRY', 'ADMIN', 'HR'],
        metadata: {
          taskId: pantryTaskId,
          roomName,
          candidateName,
          taskType: 'ROOM_PREP',
        },
      });
    }
  }

  // 3. PANTRY COMPLETES PREPARATION
  public handlePantryTaskCompleted(taskId: string, stewardName: string) {
    const timestamp = new Date().toISOString();
    let roomName = '';
    let roomId = '';
    let candidateName = '';

    dbService.update((draft) => {
      const task = draft.pantryTasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Pantry task not found');

      task.status = 'COMPLETED';
      task.completedAt = timestamp;
      task.completedBy = stewardName;
      roomName = task.roomName;
      roomId = task.roomId;
      candidateName = task.candidateName;

      // Update timeline
      const room = draft.rooms.find((r) => r.id === roomId);
      if (room?.currentCandidateId) {
        draft.timelineEvents.unshift({
          id: `tl-${Date.now()}-pantry-done`,
          candidateId: room.currentCandidateId,
          timestamp,
          actorType: 'USER',
          actorName: stewardName,
          eventType: 'PANTRY_PREPARATION_COMPLETED',
          description: `${roomName} hospitality & water setup marked complete by Pantry.`,
        });
      }

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'USER',
        actorName: stewardName,
        actorRole: 'PANTRY',
        action: 'COMPLETE_PANTRY_TASK',
        details: `Completed hospitality preparation for ${roomName}.`,
        entityId: taskId,
        entityType: 'PANTRY_TASK',
      });
    });

    this.publishDomainEvent({
      eventType: 'PANTRY_TASK_COMPLETED',
      taskId,
      roomId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      metadata: { taskId, roomId, roomName, candidateName, stewardName },
    });
  }

  // 4. INTERVIEWER STARTS INTERVIEW
  public handleInterviewStarted(interviewId: string, interviewerName: string) {
    const timestamp = new Date().toISOString();
    let candId = '';
    let candName = '';
    let roomName = '';
    let roomId = '';

    dbService.update((draft) => {
      const intv = draft.interviews.find((i) => i.id === interviewId);
      if (!intv) throw new Error('Interview not found');

      intv.status = 'INTERVIEW_STARTED';
      intv.startedAt = timestamp;
      candId = intv.candidateId;
      candName = intv.candidateName;

      const cand = draft.candidates.find((c) => c.id === intv.candidateId);
      if (cand) {
        cand.status = 'IN_INTERVIEW';
      }

      if (intv.roomId) {
        roomId = intv.roomId;
        const room = draft.rooms.find((r) => r.id === intv.roomId);
        if (room) {
          room.status = 'OCCUPIED';
          roomName = room.name;
        }
      }

      draft.timelineEvents.unshift({
        id: `tl-${Date.now()}-intv-started`,
        candidateId: candId,
        timestamp,
        actorType: 'USER',
        actorName: interviewerName,
        eventType: 'INTERVIEW_STARTED',
        description: `Interview started by ${interviewerName} (${intv.roundName}) in ${roomName || 'assigned room'}.`,
      });

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'USER',
        actorName: interviewerName,
        actorRole: 'INTERVIEWER',
        action: 'START_INTERVIEW',
        details: `Started interview ${interviewId} with candidate ${candName} in ${roomName}.`,
        entityId: interviewId,
        entityType: 'INTERVIEW',
      });
    });

    this.publishDomainEvent({
      eventType: 'INTERVIEW_STARTED',
      interviewId,
      candidateId: candId,
      roomId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      metadata: { interviewId, candidateId: candId, candidateName: candName, roomName, interviewerName },
    });
  }

  // 5. INTERVIEWER ENDS INTERVIEW WITH HUMAN DECISION
  public handleInterviewCompleted(
    interviewId: string,
    interviewerName: string,
    outcome: 'NEXT_INTERVIEW' | 'HOLD' | 'REJECTED' | 'SELECTED',
    notes: string,
    nextInterviewerId?: string,
    nextRoundName?: string
  ) {
    const timestamp = new Date().toISOString();
    let candId = '';
    let candName = '';
    let previousRoomId = '';
    let previousRoomName = '';
    let nextInterviewerName = '';
    let newInterviewId = '';

    dbService.update((draft) => {
      const intv = draft.interviews.find((i) => i.id === interviewId);
      if (!intv) throw new Error('Interview not found');

      intv.status = 'INTERVIEW_COMPLETED';
      intv.completedAt = timestamp;
      intv.outcome = outcome;
      intv.interviewerFeedback = notes;
      candId = intv.candidateId;
      candName = intv.candidateName;
      previousRoomId = intv.roomId || '';

      const cand = draft.candidates.find((c) => c.id === intv.candidateId);
      const room = draft.rooms.find((r) => r.id === previousRoomId);

      if (room) {
        previousRoomName = room.name;
        room.status = 'AVAILABLE';
        room.currentCandidateId = undefined;
        room.currentCandidateName = undefined;
        room.currentInterviewId = undefined;
        room.assignedInterviewerName = undefined;

        draft.pantryTasks.unshift({
          id: `pantry-reset-${Date.now()}`,
          roomId: room.id,
          roomName: room.name,
          candidateName: candName,
          taskType: 'ROOM_RESET',
          description: `Reset & sanitize ${room.name} following interview with ${candName}.`,
          requiredItems: ['Clear used water bottles', 'Sanitize table', 'Reset chairs'],
          priority: 'NORMAL',
          status: 'PENDING',
          createdAt: timestamp,
        });
      }

      if (outcome === 'NEXT_INTERVIEW') {
        const nextIntvUser = draft.users.find((u) => u.id === nextInterviewerId);
        nextInterviewerName = nextIntvUser?.name || 'Next Interviewer';
        newInterviewId = `intv-${Date.now()}`;

        const newIntv: Interview = {
          id: newInterviewId,
          candidateId: candId,
          candidateName: candName,
          position: cand?.position || intv.position,
          roundName: nextRoundName || 'Next Evaluation Round',
          interviewerId: nextInterviewerId || '',
          interviewerName: nextInterviewerName,
          scheduledTime: 'Immediate / Today',
          status: 'CANDIDATE_ARRIVED',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        draft.interviews.push(newIntv);

        if (cand) {
          cand.status = 'WAITING';
          cand.currentLocation = 'Waiting Area / Lounge';
          cand.currentInterviewId = newIntv.id;
        }

        if (nextInterviewerId) {
          draft.notifications.unshift({
            id: `notif-${Date.now()}-next-intv`,
            recipientRole: 'INTERVIEWER',
            recipientUserId: nextInterviewerId,
            title: 'Candidate Ready for Next Round',
            message: `${candName} has cleared ${intv.roundName} and is waiting for ${newIntv.roundName} with you.`,
            priority: 'HIGH',
            eventType: 'NEXT_INTERVIEW_CREATED',
            entityId: newIntv.id,
            entityType: 'INTERVIEW',
            read: false,
            createdAt: timestamp,
            actionButtons: [
              { label: 'View Profile', actionKey: 'VIEW_CANDIDATE', payload: { candidateId: candId } },
            ],
          });
        }

        draft.notifications.unshift({
          id: `notif-${Date.now()}-hr-next`,
          recipientRole: 'HR',
          title: `Stage Cleared: ${candName}`,
          message: `${candName} advanced to ${newIntv.roundName} with ${nextInterviewerName}. Room assignment required.`,
          priority: 'HIGH',
          eventType: 'NEXT_INTERVIEW_CREATED',
          entityId: candId,
          entityType: 'CANDIDATE',
          read: false,
          createdAt: timestamp,
          actionButtons: [
            { label: 'Assign Room', actionKey: 'ASSIGN_ROOM', payload: { candidateId: candId, interviewId: newIntv.id } },
          ],
        });

        draft.timelineEvents.unshift({
          id: `tl-${Date.now()}-next`,
          candidateId: candId,
          timestamp,
          actorType: 'USER',
          actorName: interviewerName,
          eventType: 'ADVANCED_TO_NEXT_STAGE',
          description: `Candidate advanced to ${newIntv.roundName} with ${nextInterviewerName}. Candidate moved back to Waiting Lounge.`,
        });
      } else {
        if (cand) {
          cand.status = outcome === 'SELECTED' ? 'OFFERED' : outcome === 'REJECTED' ? 'REJECTED' : 'COMPLETED';
          cand.currentLocation = 'Reception - Awaiting Checkout';
        }

        draft.notifications.unshift({
          id: `notif-${Date.now()}-rec-co`,
          recipientRole: 'RECEPTION',
          title: 'Candidate Completed Interview - Ready for Checkout',
          message: `${candName} has finished their interview process. Assist with visitor exit and checkout.`,
          priority: 'NORMAL',
          eventType: 'READY_FOR_CHECKOUT',
          entityId: candId,
          entityType: 'CANDIDATE',
          read: false,
          createdAt: timestamp,
          actionButtons: [
            { label: 'Process Checkout', actionKey: 'CHECKOUT_CANDIDATE', payload: { candidateId: candId } },
          ],
        });

        draft.timelineEvents.unshift({
          id: `tl-${Date.now()}-end-intv`,
          candidateId: candId,
          timestamp,
          actorType: 'USER',
          actorName: interviewerName,
          eventType: 'INTERVIEW_OUTCOME_RECORDED',
          description: `Interview concluded with outcome: ${outcome}. Feedback recorded. Room ${previousRoomName} released.`,
        });
      }

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'USER',
        actorName: interviewerName,
        actorRole: 'INTERVIEWER',
        action: 'COMPLETE_INTERVIEW',
        details: `Concluded interview ${interviewId} for ${candName} with outcome ${outcome}.`,
        entityId: interviewId,
        entityType: 'INTERVIEW',
      });
    });

    this.publishDomainEvent({
      eventType: 'INTERVIEW_COMPLETED',
      interviewId,
      candidateId: candId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      metadata: {
        interviewId,
        candidateId: candId,
        candidateName: candName,
        outcome,
        previousRoomName,
        nextInterviewId: newInterviewId || undefined,
      },
    });
  }

  // 6. VISITOR / CANDIDATE CHECKOUT BY RECEPTION
  public handleCheckout(candidateId: string, receptionistName: string) {
    const timestamp = new Date().toISOString();
    let candName = '';
    let durationMinutes = 0;

    dbService.update((draft) => {
      const cand = draft.candidates.find((c) => c.id === candidateId);
      if (!cand) throw new Error('Candidate not found');

      candName = cand.fullName;
      cand.status = 'CHECKED_OUT';
      cand.currentLocation = 'Departed / Checked Out';
      cand.checkOutTime = timestamp;

      if (cand.arrivalTime) {
        const arrTime = new Date(cand.arrivalTime).getTime();
        const depTime = new Date(timestamp).getTime();
        durationMinutes = Math.max(1, Math.round((depTime - arrTime) / 60000));
        cand.totalDurationMinutes = durationMinutes;
      }

      draft.timelineEvents.unshift({
        id: `tl-${Date.now()}-checkout`,
        candidateId,
        timestamp,
        actorType: 'USER',
        actorName: receptionistName,
        eventType: 'VISITOR_CHECKED_OUT',
        description: `Candidate physical exit processed. Total visit duration: ${durationMinutes} minutes. Complete audit log sealed.`,
      });

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        actorType: 'USER',
        actorName: receptionistName,
        actorRole: 'RECEPTION',
        action: 'VISITOR_CHECKOUT',
        details: `Processed physical checkout for ${candName} (${candidateId}). Duration: ${durationMinutes} mins.`,
        entityId: candidateId,
        entityType: 'CANDIDATE',
      });
    });

    this.publishDomainEvent({
      eventType: 'CANDIDATE_CHECKED_OUT',
      candidateId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      metadata: { candidateId, candidateName: candName, durationMinutes },
    });
  }

  public onCandidateLivePhotoCaptured(
    candidateId: string,
    arrivalPhoto: string,
    capturedBy: string,
    capturedByName: string
  ) {
    const timestamp = new Date().toISOString();
    let candName = 'Candidate';

    dbService.update((draft) => {
      const cand = draft.candidates.find((c) => c.id === candidateId);
      if (!cand) throw new Error('Candidate not found');
      candName = cand.fullName;
      cand.arrivalPhoto = arrivalPhoto;
      cand.arrivalPhotoCapturedAt = timestamp;
      cand.arrivalPhotoCapturedBy = capturedBy;
      cand.arrivalPhotoCapturedByName = capturedByName;
      if (!cand.livePhoto) {
        cand.livePhoto = arrivalPhoto;
      }
      cand.updatedAt = timestamp;

      draft.timelineEvents.unshift({
        id: `tl-${Date.now()}-photo`,
        candidateId,
        timestamp,
        actorType: 'USER',
        actorName: capturedByName || 'Reception Staff',
        eventType: 'LIVE_PHOTO_CAPTURED',
        description: `Physical live arrival photo captured & verified at reception desk by ${capturedByName || 'Reception Staff'}.`,
      });

      draft.auditLogs.unshift({
        id: `aud-${Date.now()}-rec-photo`,
        timestamp,
        actorType: 'USER',
        actorName: capturedByName || 'Reception Staff',
        actorRole: 'RECEPTION',
        action: 'CAPTURE_RECEPTION_LIVE_PHOTO',
        details: `Receptionist ${capturedByName} captured verified live arrival photo for candidate ${candName} (${candidateId}).`,
        entityId: candidateId,
        entityType: 'CANDIDATE',
      });
    });

    this.publishDomainEvent({
      eventType: 'CANDIDATE_LIVE_PHOTO_CAPTURED',
      candidateId,
      actorType: 'STAFF',
      source: 'STAFF_ACTION',
      metadata: {
        candidateId,
        candidateName: candName,
        capturedAt: timestamp,
        capturedByName,
      },
    });
  }

  public onCandidateResumeUploaded(candidateId: string, resumeMetadata: CandidateResumeMetadata) {
    const timestamp = new Date().toISOString();
    let candName = 'Candidate';

    dbService.update((draft) => {
      const cand = draft.candidates.find((c) => c.id === candidateId);
      if (cand) {
        candName = cand.fullName;
        cand.resumeMetadata = resumeMetadata;
        cand.resumeFileName = resumeMetadata.originalFileName;
        cand.resumeFileSize = resumeMetadata.fileSize;
        cand.resumeMimeType = resumeMetadata.mimeType;
        cand.resumeUploadedAt = resumeMetadata.uploadedAt;
        cand.updatedAt = timestamp;

        draft.timelineEvents.unshift({
          id: `tl-${Date.now()}-res`,
          candidateId,
          timestamp,
          actorType: 'USER',
          actorName: candName,
          eventType: 'RESUME_UPLOADED',
          description: `Resume document "${resumeMetadata.originalFileName}" (${resumeMetadata.fileSize}) uploaded & verified in persistent storage.`,
        });

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}-res-upload`,
          timestamp,
          actorType: 'USER',
          actorName: candName,
          action: 'UPLOAD_RESUME',
          details: `Candidate ${candName} (${candidateId}) uploaded resume "${resumeMetadata.originalFileName}".`,
          entityId: candidateId,
          entityType: 'CANDIDATE',
        });
      }
    });

    this.publishDomainEvent({
      eventType: 'CANDIDATE_RESUME_UPLOADED',
      candidateId,
      actorType: 'CANDIDATE',
      source: 'CANDIDATE_REGISTRATION',
      metadata: {
        candidateId,
        candidateName: candName,
        fileName: resumeMetadata.originalFileName,
        fileSize: resumeMetadata.fileSize,
      },
    });
  }
}

export const eventWorkflowEngine = new EventWorkflowEngine();
