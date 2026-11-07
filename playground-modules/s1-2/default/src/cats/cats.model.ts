/**
 * 入门版的「类型即文档」：用 interface 描述请求体与响应体。
 *
 * 真实项目会换成 class + class-validator 装饰器，让管道自动校验 —— 那是 s2-1 的内容。
 */
export interface Cat {
  id: number;
  name: string;
  age: number;
}

/** POST /cats 的请求体：name 必填，age 可选。 */
export interface CreateCatDto {
  name: string;
  age?: number;
}

/** PATCH /cats/:id 的请求体：所有字段可选。 */
export interface UpdateCatDto {
  name?: string;
  age?: number;
}
