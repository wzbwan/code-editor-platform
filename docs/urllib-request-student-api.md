# urllib.request 学生练习 API

这组接口用于课堂演示 `urllib.request` 的 GET、POST、URL 编码、JSON 解析和错误处理。服务端使用 Prisma 查询和 `bcrypt.compare` 校验密码，不拼接 SQL 字符串。

## 1. 查询宠物数据

`GET /api/urllib/pet?studentNo=学号&password=密码`

也兼容 `username` 参数：

`GET /api/urllib/pet?username=学号&password=密码`

返回示例：

```json
{
  "student": {
    "id": "clx...",
    "studentNo": "20240001",
    "name": "张三",
    "className": "软件1班",
    "pointBalance": 12.5
  },
  "pet": {
    "id": "clx...",
    "name": "焰尾狐",
    "level": 3,
    "exp": 45
  },
  "availablePets": []
}
```

Python 示例：

```python
from urllib.parse import urlencode
from urllib.request import urlopen
import json

base_url = "https://python.zengbao.wang/api/urllib/pet"
params = urlencode({"studentNo": "20240001", "password": "123456"})

with urlopen(f"{base_url}?{params}") as response:
    data = json.loads(response.read().decode("utf-8"))

print(data)
```

## 2. 查询个人积分流水

`POST /api/urllib/points`

支持 JSON：

```json
{
  "studentNo": "20240001",
  "password": "123456",
  "take": 30
}
```

也支持表单编码，便于 `urllib.request` 练习：

```python
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

url = "http://localhost:3000/api/urllib/points"
body = urlencode({
    "studentNo": "20240001",
    "password": "123456",
    "take": "30",
}).encode("utf-8")

request = Request(
    url,
    data=body,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    method="POST",
)

with urlopen(request) as response:
    data = json.loads(response.read().decode("utf-8"))

print(data)
```

`take` 可省略，默认返回 30 条，最大返回 100 条。

## 3. 免密码查询宠物属性

`GET /api/urllib/pet/public?studentNo=学号`

也可以按姓名查询，重名时按学号排序取第一个：

`GET /api/urllib/pet/public?name=姓名`

还支持一个通用参数，先精确匹配学号，再精确匹配姓名：

`GET /api/urllib/pet/public?query=学号或姓名`

返回示例：

```json
{
  "studentName": "张三",
  "studentNo": "20240001",
  "className": "软件1班",
  "petName": "焰尾狐",
  "petLevel": 3,
  "attack": 24,
  "defense": 18,
  "hp": 130,
  "maxHp": 150,
  "critRate": 8.5,
  "dodgeRate": 6.5
}
```

Python 示例：

```python
from urllib.parse import urlencode
from urllib.request import urlopen
import json

base_url = "http://localhost:3000/api/urllib/pet/public"
params = urlencode({"name": "张三"})

with urlopen(f"{base_url}?{params}") as response:
    data = json.loads(response.read().decode("utf-8"))

print(data)
```

## 安全说明

- 服务端没有使用原始 SQL，也没有把学生输入拼接进 SQL 字符串。
- 学号会先 `trim`，密码只用于 `bcrypt.compare`。
- 认证失败统一返回 `学号或密码错误`，避免暴露账号是否存在。
- 密码错误会复用系统登录限流，连续错误需要等待后再试。
- GET 参数会出现在浏览器地址、代理和访问日志里，这里是为了课堂练习按要求保留；正式系统建议把密码放在 HTTPS POST 请求体中。
