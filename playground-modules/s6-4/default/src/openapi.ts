import 'reflect-metadata';

/**
 * 手写版 Swagger：@ApiProperty + OpenAPI 文档生成器。
 *
 * 真实项目用的是 @nestjs/swagger：
 *   - DTO 字段上加 @ApiProperty({ description, example })；
 *   - main.ts 里
 *       const config = new DocumentBuilder().setTitle('...').setVersion('2.0').build();
 *       const document = SwaggerModule.createDocument(app, config);
 *       SwaggerModule.setup('docs', app, document);
 *     SwaggerModule 会扫描控制器的路由和 DTO 的类型元数据，自动生成文档与 UI。
 *
 * 这里没装 @nestjs/swagger，所以：
 *   - 用 PropertyDecorator 把字段描述写进类的元数据（等价 @ApiProperty）；
 *   - 用一张手写的路由清单（见 docs.controller.ts 的 DOCUMENTED_ROUTES）拼出
 *     OpenAPI 3 文档 —— 真实项目这一步是全自动的。
 */

export interface ApiPropertyOptions {
  description?: string;
  type?: 'string' | 'number' | 'boolean';
  example?: unknown;
  required?: boolean;
}

const API_PROPERTIES_KEY = '__api_properties__';

/** 等价 @nestjs/swagger 的 @ApiProperty（可选字段可传 required: false）。 */
export function ApiProperty(options: ApiPropertyOptions = {}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const ctor = (target as { constructor: Function }).constructor;
    const properties: Record<string, ApiPropertyOptions> = {
      ...(Reflect.getMetadata(API_PROPERTIES_KEY, ctor) ?? {}),
    };
    properties[String(propertyKey)] = { required: true, ...options };
    Reflect.defineMetadata(API_PROPERTIES_KEY, properties, ctor);
  };
}

export function getApiProperties(dto: Function): Record<string, ApiPropertyOptions> {
  return Reflect.getMetadata(API_PROPERTIES_KEY, dto) ?? {};
}

/** 把一个 DTO 类转成 OpenAPI 的 schema 对象（等价 @nestjs/swagger 的模型扫描）。 */
export function schemaForDto(dto: Function): Record<string, unknown> {
  const properties = getApiProperties(dto);
  const required: string[] = [];
  const schemaProperties: Record<string, unknown> = {};
  for (const name of Object.keys(properties)) {
    const options = properties[name];
    schemaProperties[name] = {
      type: options.type ?? 'string',
      description: options.description,
      example: options.example,
    };
    if (options.required) required.push(name);
  }
  return { type: 'object', properties: schemaProperties, required };
}

export interface DocumentedRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  /** 成功状态码，默认 200。 */
  status?: number;
  /** 请求体 DTO；给了它，文档里就会出现 requestBody schema。 */
  body?: Function;
}

export const API_TITLE = 'Nest 操练场 · 订单服务';
export const API_VERSION = '2.0.0';

/** 把路由清单 + DTO 元数据拼成 OpenAPI 3.0.3 文档。 */
export function buildOpenApiDocument(routes: DocumentedRoute[]): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const operation: Record<string, unknown> = {
      summary: route.summary,
      tags: [route.path.split('/')[1] ?? 'api'],
      responses: {
        [String(route.status ?? 200)]: { description: '成功' },
      },
    };
    if (route.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: schemaForDto(route.body) } },
      };
    }
    const pathItem = paths[route.path] ?? {};
    pathItem[route.method.toLowerCase()] = operation;
    paths[route.path] = pathItem;
  }
  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description: '由 src/openapi.ts 手写生成；真实项目换成 @nestjs/swagger 的 SwaggerModule.createDocument。',
    },
    servers: [{ url: '/' }],
    paths,
  };
}
