export type TestCase = {
  args: unknown[];
  expected: unknown;
  description: string;
  tolerance?: number;
  checkIsPosition?: boolean;
};

export type Solution = {
  label: string;
  code: string;
};

export type Challenge = {
  id: string;
  title: string;
  difficulty: "简单" | "中等" | "困难";
  description: string;
  starterCode: string;
  solutions: Solution[];
  testCases: TestCase[];
};

export const CHALLENGES: Challenge[] = [
  {
    id: "sort",
    title: "数组排序",
    difficulty: "简单",
    description: `实现函数 solve(arr)，对整数数组进行升序排序，返回排序后的新数组。

示例：
  solve([3, 1, 2])        → [1, 2, 3]
  solve([5, 4, 3, 2, 1])  → [1, 2, 3, 4, 5]

提示：可以使用冒泡排序、选择排序或任意排序算法。`,
    starterCode: `def solve(arr):
    pass
`,
    solutions: [
      {
        label: "冒泡排序",
        code: `def solve(arr):
    result = arr[:]
    n = len(result)
    for i in range(n):
        for j in range(0, n - i - 1):
            if result[j] > result[j + 1]:
                result[j], result[j + 1] = result[j + 1], result[j]
    return result
`,
      },
      {
        label: "选择排序",
        code: `def solve(arr):
    result = arr[:]
    n = len(result)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if result[j] < result[min_idx]:
                min_idx = j
        result[i], result[min_idx] = result[min_idx], result[i]
    return result
`,
      },
      {
        label: "归并排序",
        code: `def solve(arr):
    if len(arr) <= 1:
        return arr[:]
    mid = len(arr) // 2
    left = solve(arr[:mid])
    right = solve(arr[mid:])
    result, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]
`,
      },
      {
        label: "内置排序",
        code: `def solve(arr):
    return sorted(arr)
`,
      },
    ],
    testCases: [
      { args: [[3, 1, 2]], expected: [1, 2, 3], description: "基础三元素" },
      { args: [[5, 4, 3, 2, 1]], expected: [1, 2, 3, 4, 5], description: "逆序五元素" },
      { args: [[1]], expected: [1], description: "单元素" },
      { args: [[]], expected: [], description: "空数组" },
      { args: [[2, 2, 1, 3]], expected: [1, 2, 2, 3], description: "含重复元素" },
      { args: [[-3, 0, 5, -1]], expected: [-3, -1, 0, 5], description: "含负数" },
    ],
  },
  {
    id: "binary-search",
    title: "二分查找",
    difficulty: "简单",
    description: `实现函数 solve(arr, target)，在有序数组 arr 中查找 target，返回其索引。若不存在，返回 -1。

示例：
  solve([1, 3, 5, 7, 9], 5) → 2
  solve([1, 3, 5, 7, 9], 6) → -1

要求：时间复杂度 O(log n)。`,
    starterCode: `def solve(arr, target):
    pass
`,
    solutions: [
      {
        label: "迭代",
        code: `def solve(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
`,
      },
      {
        label: "递归",
        code: `def solve(arr, target, left=0, right=None):
    if right is None:
        right = len(arr) - 1
    if left > right:
        return -1
    mid = (left + right) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return solve(arr, target, mid + 1, right)
    else:
        return solve(arr, target, left, mid - 1)
`,
      },
    ],
    testCases: [
      { args: [[1, 3, 5, 7, 9], 5], expected: 2, description: "查找中间元素" },
      { args: [[1, 3, 5, 7, 9], 1], expected: 0, description: "查找首元素" },
      { args: [[1, 3, 5, 7, 9], 9], expected: 4, description: "查找末元素" },
      { args: [[1, 3, 5, 7, 9], 6], expected: -1, description: "元素不存在" },
      { args: [[], 1], expected: -1, description: "空数组" },
      { args: [[1], 1], expected: 0, description: "单元素命中" },
    ],
  },
  {
    id: "fibonacci",
    title: "斐波那契数列",
    difficulty: "简单",
    description: `实现函数 solve(n)，返回第 n 个斐波那契数（从 0 开始）。

定义：f(0)=0, f(1)=1, f(n)=f(n-1)+f(n-2)

示例：
  solve(0) → 0
  solve(6) → 8
  solve(10) → 55`,
    starterCode: `def solve(n):
    pass
`,
    solutions: [
      {
        label: "迭代",
        code: `def solve(n):
    if n <= 0:
        return 0
    if n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
`,
      },
      {
        label: "递归",
        code: `def solve(n):
    if n <= 0:
        return 0
    if n == 1:
        return 1
    return solve(n - 1) + solve(n - 2)
`,
      },
      {
        label: "记忆化递归",
        code: `def solve(n, memo={}):
    if n <= 0:
        return 0
    if n == 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = solve(n - 1, memo) + solve(n - 2, memo)
    return memo[n]
`,
      },
    ],
    testCases: [
      { args: [0], expected: 0, description: "f(0)" },
      { args: [1], expected: 1, description: "f(1)" },
      { args: [5], expected: 5, description: "f(5)" },
      { args: [6], expected: 8, description: "f(6)" },
      { args: [10], expected: 55, description: "f(10)" },
      { args: [15], expected: 610, description: "f(15)" },
    ],
  },
  {
    id: "valid-brackets",
    title: "有效括号",
    difficulty: "中等",
    description: `实现函数 solve(s)，判断括号字符串是否有效，返回 True 或 False。

有效规则：
  - 每个左括号必须有对应的右括号
  - 括号必须以正确顺序闭合
  - 支持 ()、[]、{}

示例：
  solve("()[]{}") → True
  solve("([)]")   → False
  solve("{[]}")   → True`,
    starterCode: `def solve(s):
    pass
`,
    solutions: [
      {
        label: "栈",
        code: `def solve(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in ')]}':
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
    return len(stack) == 0
`,
      },
    ],
    testCases: [
      { args: ["()"], expected: true, description: "单对括号" },
      { args: ["()[]{}"], expected: true, description: "多种括号" },
      { args: ["{[]}"], expected: true, description: "嵌套括号" },
      { args: ["([)]"], expected: false, description: "交叉括号" },
      { args: ["{"], expected: false, description: "未闭合" },
      { args: [""], expected: true, description: "空字符串" },
    ],
  },
  {
    id: "shortest-path",
    title: "最短路径",
    difficulty: "困难",
    description: `实现函数 solve(graph, start, end)，求从 start 到 end 的最短路径，返回经过的节点列表。

graph 格式：邻接字典，graph[u][v] = 权重

示例：
  graph = {"A":{"B":4,"C":2},"B":{"D":3},"C":{"B":1,"D":5},"D":{}}
  solve(graph, "A", "D") → ["A", "C", "B", "D"]   # 总权重 2+1+3=6

若不可达，返回空列表 []。

提示：右侧图面板会用一张路网图（节点 0~499，25×20 网格）可视化你的算法结果，测试用例使用独立的小图验证正确性。`,
    starterCode: `def solve(graph, start, end):
    pass
`,
    solutions: [
      {
        label: "Dijkstra",
        code: `import heapq

def solve(graph, start, end):
    dist = {node: float('inf') for node in graph}
    dist[start] = 0
    prev = {}
    pq = [(0, start)]
    while pq:
        cost, u = heapq.heappop(pq)
        if cost > dist[u]:
            continue
        for v, w in graph[u].items():
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                heapq.heappush(pq, (dist[v], v))
    if dist[end] == float('inf'):
        return []
    path, node = [], end
    while node in prev:
        path.append(node)
        node = prev[node]
    path.append(start)
    path.reverse()
    return path
`,
      },
      {
        label: "Bellman-Ford",
        code: `def solve(graph, start, end):
    dist = {n: float('inf') for n in graph}
    dist[start] = 0
    prev = {}
    edges = [(u, v, w) for u in graph for v, w in graph[u].items()]
    for _ in range(len(graph) - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
    if dist[end] == float('inf'):
        return []
    path, node = [], end
    while node in prev:
        path.append(node)
        node = prev[node]
    path.append(start)
    path.reverse()
    return path
`,
      },
      {
        label: "BFS（无权图）",
        code: `from collections import deque

def solve(graph, start, end):
    prev = {}
    visited = {start}
    queue = deque([start])
    while queue:
        u = queue.popleft()
        if u == end:
            break
        for v in graph[u]:
            if v not in visited:
                visited.add(v)
                prev[v] = u
                queue.append(v)
    if end not in prev and end != start:
        return []
    path, node = [], end
    while node in prev:
        path.append(node)
        node = prev[node]
    path.append(start)
    path.reverse()
    return path
`,
      },
      {
        label: "A*",
        code: `import heapq
import math

def solve(graph, start, end):
    # 有 positions 时用欧氏距离启发，否则退化为 Dijkstra
    def h(u):
        try:
            if u in positions and end in positions:
                x1, y1 = positions[u]; x2, y2 = positions[end]
                return math.hypot(x2-x1, y2-y1) * 0.015
        except Exception:
            pass
        return 0
    dist = {n: float('inf') for n in graph}
    dist[start] = 0
    prev = {}
    pq = [(h(start), 0, start)]
    while pq:
        _, cost, u = heapq.heappop(pq)
        if cost > dist[u]:
            continue
        if u == end:
            break
        for v, w in graph[u].items():
            nd = dist[u] + w
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd + h(v), nd, v))
    if dist[end] == float('inf'):
        return []
    path, node = [], end
    while node in prev:
        path.append(node); node = prev[node]
    path.append(start); path.reverse()
    return path
`,
      },
      {
        label: "贪心最佳优先",
        code: `import heapq
import math

def solve(graph, start, end):
    # 只看启发值，不保证最优（无坐标时退化为 BFS）
    def h(u):
        try:
            if u in positions and end in positions:
                x1, y1 = positions[u]; x2, y2 = positions[end]
                return math.hypot(x2-x1, y2-y1)
        except Exception:
            pass
        return 0
    visited = set()
    prev = {}
    pq = [(h(start), start)]
    while pq:
        _, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        if u == end:
            break
        for v in graph[u]:
            if v not in visited:
                if v not in prev:
                    prev[v] = u
                heapq.heappush(pq, (h(v), v))
    if end not in prev and end != start:
        return []
    path, node = [], end
    while node in prev:
        path.append(node); node = prev[node]
    path.append(start); path.reverse()
    return path
`,
      },
      {
        label: "DFS",
        code: `def solve(graph, start, end):
    # 深度优先，找到一条路但不保证最短
    visited = set()
    prev = {}
    stack = [start]
    while stack:
        u = stack.pop()
        if u in visited:
            continue
        visited.add(u)
        if u == end:
            break
        for v in graph[u]:
            if v not in visited:
                prev[v] = u
                stack.append(v)
    if end not in prev and end != start:
        return []
    path, node = [], end
    while node in prev:
        path.append(node); node = prev[node]
    path.append(start); path.reverse()
    return path
`,
      },
      {
        label: "双向Dijkstra",
        code: `import heapq

def solve(graph, start, end):
    rev = {u: {} for u in graph}
    for u in graph:
        for v, w in graph[u].items():
            rev[v][u] = w
    dist_f = {n: float('inf') for n in graph}
    dist_b = {n: float('inf') for n in graph}
    dist_f[start] = 0; dist_b[end] = 0
    prev_f, prev_b = {}, {}
    settled_f, settled_b = set(), set()
    pq_f = [(0, start)]; pq_b = [(0, end)]
    best = float('inf'); meeting = None
    while pq_f or pq_b:
        if pq_f:
            d, u = heapq.heappop(pq_f)
            if d <= dist_f[u]:
                settled_f.add(u)
                if u in settled_b and dist_f[u] + dist_b[u] < best:
                    best = dist_f[u] + dist_b[u]; meeting = u
                for v, w in graph[u].items():
                    if dist_f[u] + w < dist_f[v]:
                        dist_f[v] = dist_f[u] + w; prev_f[v] = u
                        heapq.heappush(pq_f, (dist_f[v], v))
        if pq_b:
            d, u = heapq.heappop(pq_b)
            if d <= dist_b[u]:
                settled_b.add(u)
                if u in settled_f and dist_f[u] + dist_b[u] < best:
                    best = dist_f[u] + dist_b[u]; meeting = u
                for v, w in rev[u].items():
                    if dist_b[u] + w < dist_b[v]:
                        dist_b[v] = dist_b[u] + w; prev_b[v] = u
                        heapq.heappush(pq_b, (dist_b[v], v))
        if pq_f and pq_b and pq_f[0][0] + pq_b[0][0] >= best:
            break
    if meeting is None:
        return []
    path_f, node = [], meeting
    while node in prev_f:
        path_f.append(node); node = prev_f[node]
    path_f.append(start); path_f.reverse()
    path_b, node = [], meeting
    while node in prev_b:
        node = prev_b[node]; path_b.append(node)
    return path_f + path_b
`,
      },
    ],
    testCases: [
      {
        args: [{ A: { B: 1 }, B: {}, C: { D: 1 }, D: {} }, "A", "D"],
        expected: [],
        description: "不可达返回 []",
      },
      {
        args: [{ A: { B: 5 }, B: {} }, "A", "B"],
        expected: ["A", "B"],
        description: "直连路径",
      },
      {
        args: [{ A: { B: 2 }, B: { C: 3 }, C: {} }, "A", "C"],
        expected: ["A", "B", "C"],
        description: "链式路径",
      },
    ],
  },
  {
    id: "bearing-positioning",
    title: "方位角定位",
    difficulty: "困难",
    description: `实现函数 solve(stations, measurements)，根据多个观测站的方位角测量值，求目标点经纬度。

stations: 观测站列表，每项为 {"id": str, "lng": float, "lat": float}
measurements: 测量列表，每项为 {"stationId": str, "bearingDeg": float}
  bearingDeg 为从正北方向顺时针的角度（0°=北，90°=东，180°=南，270°=西）

返回值：(lng, lat) 元组，表示目标点经纬度。

坐标系：lng 向东为正，lat 向北为正。
方位角公式：bearing = atan2(dlng, dlat)，其中 dlng=目标lng-站lng，dlat=目标lat-站lat

提示：可用最小二乘法联立多条方位线方程求解。
右侧面板会可视化观测站、方位线和你的解。`,
    starterCode: `def solve(stations, measurements):
    pass
`,
    solutions: [
      {
        label: "最小二乘法",
        code: `import math

def solve(stations, measurements):
    station_map = {s["id"]: (s["lng"], s["lat"]) for s in stations}
    A, b = [], []
    for m in measurements:
        slng, slat = station_map[m["stationId"]]
        theta = math.radians(m["bearingDeg"])
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        A.append([cos_t, -sin_t])
        b.append(slng * cos_t - slat * sin_t)
    a00 = sum(r[0]*r[0] for r in A)
    a01 = sum(r[0]*r[1] for r in A)
    a11 = sum(r[1]*r[1] for r in A)
    b0  = sum(A[i][0]*b[i] for i in range(len(b)))
    b1  = sum(A[i][1]*b[i] for i in range(len(b)))
    det = a00*a11 - a01*a01
    if abs(det) < 1e-10:
        return (0.0, 0.0)
    lng = (a11*b0 - a01*b1) / det
    lat = (a00*b1 - a01*b0) / det
    return (lng, lat)
`,
      },
      {
        label: "直接交叉法（两站）",
        code: `import math

def solve(stations, measurements):
    station_map = {s["id"]: (s["lng"], s["lat"]) for s in stations}
    if len(measurements) < 2:
        return (0.0, 0.0)
    m1, m2 = measurements[0], measurements[1]
    lng1, lat1 = station_map[m1["stationId"]]
    lng2, lat2 = station_map[m2["stationId"]]
    t1 = math.radians(m1["bearingDeg"])
    t2 = math.radians(m2["bearingDeg"])
    d1x, d1y = math.sin(t1), math.cos(t1)
    d2x, d2y = math.sin(t2), math.cos(t2)
    denom = d1x*d2y - d1y*d2x
    if abs(denom) < 1e-10:
        return (0.0, 0.0)
    t = ((lng2-lng1)*d2y - (lat2-lat1)*d2x) / denom
    return (lng1 + t*d1x, lat1 + t*d1y)
`,
      },
      {
        label: "三站平均交叉",
        code: `import math

def solve(stations, measurements):
    # 对所有站对求交叉点，取平均
    station_map = {s["id"]: (s["lng"], s["lat"]) for s in stations}
    points = []
    ms = measurements
    for i in range(len(ms)):
        for j in range(i + 1, len(ms)):
            lng1, lat1 = station_map[ms[i]["stationId"]]
            lng2, lat2 = station_map[ms[j]["stationId"]]
            t1 = math.radians(ms[i]["bearingDeg"])
            t2 = math.radians(ms[j]["bearingDeg"])
            d1x, d1y = math.sin(t1), math.cos(t1)
            d2x, d2y = math.sin(t2), math.cos(t2)
            denom = d1x*d2y - d1y*d2x
            if abs(denom) < 1e-10:
                continue
            t = ((lng2-lng1)*d2y - (lat2-lat1)*d2x) / denom
            points.append((lng1 + t*d1x, lat1 + t*d1y))
    if not points:
        return (0.0, 0.0)
    return (sum(p[0] for p in points)/len(points),
            sum(p[1] for p in points)/len(points))
`,
      },
      {
        label: "梯度下降",
        code: `import math

def solve(stations, measurements):
    station_map = {s["id"]: (s["lng"], s["lat"]) for s in stations}
    # 最小化各方位线到点的距离平方和
    def loss_grad(lng, lat):
        loss, glng, glat = 0.0, 0.0, 0.0
        for m in measurements:
            slng, slat = station_map[m["stationId"]]
            theta = math.radians(m["bearingDeg"])
            # 法向量 (cos_t, -sin_t)，方位线方程: cos_t*(L-slng) - sin_t*(B-slat) = 0
            cos_t, sin_t = math.cos(theta), math.sin(theta)
            r = cos_t*(lng - slng) - sin_t*(lat - slat)
            loss += r * r
            glng += 2 * r * cos_t
            glat += 2 * r * (-sin_t)
        return loss, glng, glat
    # 初始点：所有站的重心
    lng = sum(s["lng"] for s in stations) / len(stations)
    lat = sum(s["lat"] for s in stations) / len(stations)
    lr = 1.0
    for _ in range(2000):
        _, glng, glat = loss_grad(lng, lat)
        lng -= lr * glng
        lat -= lr * glat
        lr *= 0.999
    return (lng, lat)
`,
      },
      {
        label: "加权最小二乘（距离权重）",
        code: `import math

def solve(stations, measurements):
    station_map = {s["id"]: (s["lng"], s["lat"]) for s in stations}
    # 迭代加权：距离越近权重越大
    lng = sum(s["lng"] for s in stations) / len(stations)
    lat = sum(s["lat"] for s in stations) / len(stations)
    for _ in range(10):
        A, b, w = [], [], []
        for m in measurements:
            slng, slat = station_map[m["stationId"]]
            theta = math.radians(m["bearingDeg"])
            cos_t, sin_t = math.cos(theta), math.sin(theta)
            dist = max(1e-6, math.hypot(lng - slng, lat - slat))
            weight = 1.0 / dist
            A.append([cos_t * weight, -sin_t * weight])
            b.append((slng * cos_t - slat * sin_t) * weight)
        a00 = sum(r[0]*r[0] for r in A)
        a01 = sum(r[0]*r[1] for r in A)
        a11 = sum(r[1]*r[1] for r in A)
        b0  = sum(A[i][0]*b[i] for i in range(len(b)))
        b1  = sum(A[i][1]*b[i] for i in range(len(b)))
        det = a00*a11 - a01*a01
        if abs(det) < 1e-10:
            break
        lng = (a11*b0 - a01*b1) / det
        lat = (a00*b1 - a01*b0) / det
    return (lng, lat)
`,
      },
    ],
    testCases: [
      {
        args: [
          [{ id: "A", lng: 116.350, lat: 39.860 }, { id: "B", lng: 116.450, lat: 39.860 }, { id: "C", lng: 116.420, lat: 39.860 }],
          [
            { stationId: "A", bearingDeg: 51.34 },
            { stationId: "B", bearingDeg: 308.66 },
            { stationId: "C", bearingDeg: 333.43 },
          ],
        ],
        expected: null,
        checkIsPosition: true,
        description: "返回一个经纬度位置 (lng, lat)",
      },
    ],
  },
  {
    id: "two-sum",
    title: "两数之和",
    difficulty: "简单",
    description: `实现函数 solve(nums, target)，在数组 nums 中找到两个数使其和等于 target，返回它们的索引列表（升序）。

保证有且仅有一个解。

示例：
  solve([2, 7, 11, 15], 9) → [0, 1]
  solve([3, 2, 4], 6)      → [1, 2]`,
    starterCode: `def solve(nums, target):
    pass
`,
    solutions: [
      {
        label: "哈希表",
        code: `def solve(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return sorted([seen[complement], i])
        seen[num] = i
    return []
`,
      },
      {
        label: "暴力枚举",
        code: `def solve(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
`,
      },
    ],
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], description: "基础示例" },
      { args: [[3, 2, 4], 6], expected: [1, 2], description: "非首尾" },
      { args: [[3, 3], 6], expected: [0, 1], description: "相同元素" },
      { args: [[1, 2, 3, 4, 5], 9], expected: [3, 4], description: "末尾两数" },
    ],
  },
];
