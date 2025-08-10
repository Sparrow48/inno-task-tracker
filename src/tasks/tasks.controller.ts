import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ErrorCode } from 'src/@types/error.types';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Controller('tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);
  constructor(
    private readonly tasksService: TasksService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  @Post()
  async createTask(@Body() taskData: CreateTaskDto) {
    try {
      const createdTask = await this.tasksService.createTask(taskData);
      await this.tasksService.removeTaskFromCache();
      return createdTask;
    } catch (error) {
      if (error.status) throw error;
      this.logger.error(
        `[POST /tasks] Task creation failed with ${error.message}`,
      );
      throw new InternalServerErrorException();
    }
  }

  @Get()
  async getTasks(@Query() query: TaskQueryDto) {
    const cacheKey = `tasks:${JSON.stringify(query)}`;
    try {
      this.logger.log(
        `[GET /tasks] Start fetching task list with filters: ${JSON.stringify(query)}`,
      );

      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.log(
          `Fetched tasks from cache memory with Key: ${cacheKey}`,
        );
        return JSON.parse(cached);
      }

      const tasks = await this.tasksService.getTasks(query);

      await this.redis.set(cacheKey, JSON.stringify(tasks), 'EX', 60);

      this.logger.log(
        `[GET /tasks] Successfully fetched ${tasks?.meta?.total} tasks from DB.`,
      );

      return tasks;
    } catch (error) {
      if (error.status) throw error;
      console.log(error.stack);
      this.logger.error(
        `[GET /tasks] Failed to fetch task list. Error: ${error?.message}`,
      );
      throw new InternalServerErrorException();
    }
  }

  @Patch(':id/status')
  async updateTask(
    @Param('id') _id: string,
    @Body() body: UpdateTaskStatusDto,
  ) {
    try {
      this.logger.log(
        `[PATCH /tasks/${_id}/status] Got request to update task status for ID: ${_id}`,
      );

      const task = await this.tasksService.findOne({ _id });
      if (!task) {
        throw new HttpException(
          {
            message: 'Task not found',
            code: ErrorCode.TASK_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const updatedTask = await this.tasksService.updateTaskStatus(
        _id,
        body.status,
      );
      await this.tasksService.removeTaskFromCache();
      return updatedTask;
    } catch (error) {
      if (error.status) throw error;

      this.logger.error(
        `[PATCH /tasks/${_id}/status] Task status update request failed. Error: ${error.message}`,
      );

      throw new InternalServerErrorException();
    }
  }
}
