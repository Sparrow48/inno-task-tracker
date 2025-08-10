import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IFindTask } from 'src/@types/task.type';
import { Task } from './schemas/task.schema';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    @InjectModel(Task.name) private taskModel: Model<Task>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}
  async createTask(taskData: Partial<Task>) {
    const createdTask = new this.taskModel(taskData);
    return await createdTask.save();
  }

  async getTasks(query: IFindTask) {
    const { status, dueFrom, dueTo, search, page = '1', limit = '10' } = query;
    const filter: any = {};

    if (status) filter.status = status;
    if (dueFrom)
      filter.dueDate = { ...filter.dueDate, $gte: new Date(dueFrom) };
    if (dueTo) filter.dueDate = { ...filter.dueDate, $lte: new Date(dueTo) };
    if (search) filter.title = new RegExp(search, 'i');

    const options = {
      skip: (Number(page) - 1) * Number(limit),
      limit: Number(limit),
    };

    const tasks = await this.taskModel
      .find(filter)
      .skip(options.skip)
      .limit(options.limit)
      .select('-__v')
      .exec();

    const totalCount = await this.taskModel.countDocuments(filter).exec();

    const returnData = {
      data: tasks,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    };

    return returnData;
  }

  async findOne(query: any) {
    return await this.taskModel.findOne(query).exec();
  }

  async updateTaskStatus(_id: string, status: string) {
    return await this.taskModel
      .findByIdAndUpdate(_id, { status }, { new: true })
      .exec();
  }

  async removeTaskFromCache() {
    const keys = await this.redis.keys('tasks:*');
    if (keys.length) {
      await this.redis.del(...keys);
      this.logger.log(`[CACHE INVALIDATED] Keys: ${keys.join(', ')}`);
    }
  }
}
