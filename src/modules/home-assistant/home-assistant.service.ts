import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class HomeAssistantError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HomeAssistantError';
  }
}

@Injectable()
export class HomeAssistantService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    const baseUrl = this.configService.get<string>('HOME_ASSISTANT_URL');
    const token = this.configService.get<string>('HOME_ASSISTANT_TOKEN');

    if (!baseUrl || !token) {
      throw new Error(
        'HOME_ASSISTANT_URL и HOME_ASSISTANT_TOKEN должны быть определены',
      );
    }

    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new HomeAssistantError(response.statusText, response.status);
    }

    return response;
  }

  async getStates() {
    const response = await this.request('/api/states');
    return response.json();
  }

  async getState(entityId: string) {
    const response = await this.request(`/api/states/${entityId}`);
    return response.json();
  }

  async callService(
    domain: string,
    service: string,
    data: Record<string, any>,
  ) {
    const response = await this.request(`/api/services/${domain}/${service}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Проверяем только статус и тип контента
    if (
      response.status === 200 &&
      response.headers.get('content-type')?.includes('application/json')
    ) {
      return response.json();
    }

    return { success: true };
  }

  async getServices() {
    const response = await this.request('/api/services');
    return response.json();
  }
}
