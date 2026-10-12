import { Injectable, Logger, Optional } from '@nestjs/common';
import { EmailService } from '../mailer/email.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TeamsService } from '../teams/teams.service';
import { ProjectsHelper } from './projects.helper';

@Injectable()
export class ProjectNotificationsService {
  private readonly logger = new Logger(ProjectNotificationsService.name);

  constructor(
    private readonly projectsHelper: ProjectsHelper,
    private readonly teamsService: TeamsService,
    private readonly emailService: EmailService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async notifyTaskTeam(
    taskId: string,
    action: 'created' | 'updated',
  ): Promise<void> {
    try {
      const task = await this.projectsHelper.findTask(taskId);
      if (!task || (!task.teams?.length && !task.assignee)) return;

      const recipients = new Map<
        string,
        { userId: number; email: string; name: string }
      >();
      const memberships = task.teams?.length
        ? await Promise.all(
            task.teams.map((team) => this.teamsService.findTeamMember(team.id)),
          )
        : [];

      for (const teamMembers of memberships) {
        for (const membership of teamMembers) {
          const member = membership.user;
          if (member?.email && !recipients.has(member.email)) {
            recipients.set(member.email, {
              userId: member.user_id,
              email: member.email,
              name: member.name,
            });
          }
        }
      }

      if (task.assignee?.email && !recipients.has(task.assignee.email)) {
        recipients.set(task.assignee.email, {
          userId: task.assignee.user_id,
          email: task.assignee.email,
          name: task.assignee.name,
        });
      }

      if (recipients.size === 0) return;

      const subject =
        action === 'created'
          ? `New Task Assigned: ${task.title}`
          : `Task Updated: ${task.title}`;

      if (this.notificationsService) {
        try {
          await this.notificationsService.createMany(
            Array.from(recipients.values()).map((member) => ({
              recipientId: member.userId,
              type:
                action === 'created'
                  ? NotificationType.TASK_ASSIGNED
                  : NotificationType.TASK_UPDATED,
              title: subject,
              body: task.project?.name ? `Project: ${task.project.name}` : null,
              data: {
                taskId: task.id,
                projectId: task.project?.id,
                href: task.project?.name
                  ? `/projects/${encodeURIComponent(task.project.name)}/task`
                  : '/task',
              },
            })),
          );
        } catch (error) {
          this.logger.error(
            `Failed to create task notifications | taskId=${taskId} | error=${error.message}`,
          );
        }
      }

      const emailResults = await Promise.allSettled(
        Array.from(recipients.values()).map((member) =>
          this.emailService.sendTaskNotificationEmail(
            member.email,
            subject,
            task,
            action,
          ),
        ),
      );
      const failedEmails = emailResults.filter(
        (result) => result.status === 'rejected',
      ).length;
      if (failedEmails > 0) {
        this.logger.warn(
          `Task notification emails partially failed | taskId=${taskId} | failed=${failedEmails}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to notify task team | taskId=${taskId} | error=${error.message}`,
        error.stack,
      );
    }
  }
}
