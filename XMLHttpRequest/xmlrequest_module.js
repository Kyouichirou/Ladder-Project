(() => {
    "use strict";
    /*
        @author: hla
        @version: 1.0
        @update: 2022-08-27
        @description: tampermonkey跨域请求组件二度封装. 增加下载, 缓存访问等额外的扩展, 更为易用.
        -- MDN: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
        -- GM: https://wiki.greasespot.net/Main_Page
    */
    const xmlHTTPRequest = {
        // 访问次数
        total_visited_time: 0,
        // 是否缓存上次访问过的链接
        is_cached_visited: false,
        // 已访问列表
        visited_cache: [],
        // 是否缓存上次访问的结果
        is_cache_last: null,
        // 上次访问结果缓存
        last_cache: null,
        _result_types: [
            "",
            "document",
            "json",
            "text",
            "stream",
            "arraybuffer",
            "blob",
        ],
        // 弹出已访问
        pop_visited_url(url) {
            this.visited_cache = this.visited_cache.filter((e) => e !== url);
        },
        // 检查是否曾今访问过
        _check_visited_url(url) {
            return this.is_cached_visited && this.visited_cache.includes(url);
        },
        // 将数据转为dom
        _html2dom: (html) => new DOMParser().parseFromString(html, "text/html"),
        // 发起请求的主体
        _request_obj: null,
        _request(configs, parameters) {
            const url = configs["url"];
            console.log(
                `${configs["method"]}(${++this.total_visited_time}): + ${url}`
            );
            // 检查参数是否满足要求
            const new_configs = {};
            for (const key of Object.keys(configs))
                if (parameters.includes(key)) new_configs[key] = configs[key];
            const r = new_configs["responseType"] || "";
            if (!this._result_types.includes(r.toLowerCase()))
                new_configs["responseType"] = "";

            return new Promise((resolve, reject) => {
                if (this._check_visited_url(url)) {
                    reject("visited error");
                    return;
                }
                // GM_xmlhttpRequest(details), synchronous(不能在配置中加入异步async) flag at details is not supported
                // 目前Tampermonkey的fetch还处于测试阶段(fetch本身这个api就还是测试阶段, 很多基础功能还处于测试状态)
                /*
                    method,  one of GET, HEAD, POST, 请求的方式
                    url,  the destination URL, 链接
                    headers,  ie. user-agent, referer, ... (some special headers are not supported by Safari and Android browsers), 请求头
                    data,  some string to send via a POST request, Post专属, 需要发送的数据(注意请求的数据格式)
                    cookie,  a cookie to be patched into the sent cookie set, 默认会发送URL域所在的cookie, 这个是同时假如新的cookie一起发送
                    binary,  send the data string in binary mode, 发送数据以二进制模式
                    nocache,  don't cache the resource, 不缓存
                    revalidate,  revalidate maybe cached content
                    - 控制缓存的使用, 比no-cache更为严格
                    - 不清楚这个参数的使用场景, 相关解释: https://zhuanlan.zhihu.com/p/60357719
                    - no-cache/must-revalidate/no-store, 三者都是控制缓存的使用
                    - https://blog.csdn.net/jisuanjiguoba/article/details/82430613
                    - https://stackoverflow.com/questions/7573466/is-cache-controlmust-revalidate-obliging-to-validate-all-requests-or-just-the
                    timeout,  a timeout in ms, 超时, 以毫秒为单位
                    context,  a property which will be added to the response object, 控制返回的数据类型
                    responseType,  one of arraybuffer, blob, json or stream, 返回指定的内容类型, 支持: arraybuffer, blob. json, stream, document
                    - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseType
                    - 响应类型
                    - 空值, 不设置, 默认返回文本(text/string)
                    - json
                    - document(document/xml/xmldocument)
                    - arraybuffer(二进制数组)
                    - blob, 二进制数据(一般用这个)
                    - text, 同上, 文本
                    - ms-stream, 这里特指微软ie支持的stream流, stream
                    overrideMimeType,  a MIME type for the request, 请求MIME类型数据
                    anonymous,  don't send cookies with the requests (please see the fetch notes), 不发送cookie
                    fetch (beta),  use a fetch instead of a xhr request, 测试的fetch, 指定底层的网络请求由xhr转为fetch
                    (at Chrome this causes details.timeout and xhr.onprogress to not work and makes xhr.onreadystatechange receive only readyState 4 events)
                    --- 用户和密码
                    user, a user name for authentication
                    - 暂不清楚使用场景, 应该和代理之类的相关 ?
                    password, a password
                    ------ 各种参数的默认值
                    https://wiki.greasespot.net/GM.xmlHttpRequest
                    'method':"",
                    'url':"",
                    'headers':"",
                    'data':"",
                    'cookie':"",
                    'binary':false,
                    'nocache': false,
                    'revalidate': false,
                    'timeout':0,
                    'context':"",
                    'responseType':"",
                    'overrideMimeType':"",
                    'anonymous':false,
                    'fetch': false,
                    'user':"",
                    'password':"",
                 */
                this._request_obj = GM_xmlhttpRequest({
                    ...new_configs,
                    // 成功加载
                    onload: (response) => {
                        /*
                            finalUrl - the final URL after all redirects from where the data was loaded, 最终的链接, 如发生跳转
                            readyState - the ready state, 完成状态
                            status - the request status, 状态码
                            statusText - the request status text
                            responseHeaders - the request response headers, 响应头
                            response - the response data as object if details.responseType was set, 返回的内容, 加入设置了返回的类型, 将会返回指定格式的内容
                            responseXML - the response data as XML document, xml格式结果
                            responseText - the response data as plain string, 纯文本结果
                         */
                        this._request_obj = null;
                        const code = response.status;
                        if (code === 200) {
                            if (new_configs["method"] === "HEAD") {
                                resolve(response.responseHeaders);
                                return;
                            }
                            const ret = response.response;
                            this.last_cache = this.is_cache_last ? ret : null;
                            if (this.is_cached_visited)
                                this.visited_cache.push(url);
                            resolve(ret);
                        } else {
                            console.log(`err: code ${code}`);
                            reject(`request data error: ${code}`);
                        }
                    },
                    // 放弃执行
                    onabort: () => {
                        console.log("mission has been aborting");
                        reject("abort request");
                        this._request_obj = null;
                    },
                    // 开始加载, 限于设置了返回类型为stream的情况下起作用
                    onloadstart: () => {
                        console.log("mission has been starting");
                    },
                    // 加载中
                    onprogress: () => {
                        console.log("mission has been processing");
                    },
                    // 请求的状态发生变化
                    onreadystatechange: () => {
                        console.log("mission state has changed");
                    },
                    // 出现错误
                    onerror: (e) => {
                        console.log(e);
                        this._request_obj = null;
                        reject("something error");
                    },
                    // 超时
                    ontimeout: () => {
                        console.log("timeout error: " + url);
                        this._request_obj = null;
                        reject("timeout error");
                    },
                });
            });
        },
        cancel_request() {
            this._request_obj && this._request_obj.abort();
        },
        // 下载数据以txt形式
        _download_as_txt(content) {
            return (
                "data:text/plain;charset=utf-8," + encodeURIComponent(content)
            );
        },
        // 下载文件, 以obj形式, 如图片, 流媒体
        _downlad_as_object(content) {
            try {
                return window.URL.createObjectURL(content);
            } catch (error) {
                console.log(error);
                return null;
            }
        },
        download(filename, content) {
            const c_type = typeof content;
            let is_obj = false;
            const href =
                c_type === "string"
                    ? this._download_as_txt(content)
                    : (is_obj = c_type === "object") && content instanceof Blob
                    ? this._downlad_as_object(content)
                    : null;
            if (href === null) {
                console.log("require data type: string, object");
                return false;
            }
            let a = document.createElement("a");
            a.style = "display: none";
            a.href = href;
            a.download = filename;
            a.click();
            a.remove();
            a = null;
            is_obj && window.URL.revokeObjectURL(href);
        },
        POST(url, data, timeout, result_type, other_args_dict) {
            const parameters = [
                "method",
                "url",
                "headers",
                "data",
                "cookie",
                "binary",
                "nocache",
                "revalidate",
                "timeout",
                "context",
                "responseType",
                "overrideMimeType",
                "anonymous",
                "fetch",
                "user",
                "password",
            ];
            if (!other_args_dict || typeof other_args_dict !== "object")
                other_args_dict = {};
            const default_configs = {
                method: "POST",
                url: url,
                timeout: timeout || 3000,
                data: data,
                responseType: result_type || "",
                headers: {
                    "content-type":
                        "application/x-www-form-urlencoded;charset=UTF-8",
                },
                ...other_args_dict,
            };
            return this._request(default_configs, parameters);
        },
        GET(url, timeout, result_type, other_args_dict) {
            const parameters = [
                "method",
                "url",
                "headers",
                "cookie",
                "nocache",
                "revalidate",
                "timeout",
                "context",
                "responseType",
                "overrideMimeType",
                "anonymous",
                "fetch",
                "user",
                "password",
            ];
            if (!other_args_dict || typeof other_args_dict !== "object")
                other_args_dict = {};
            const default_configs = {
                method: "GET",
                url: url,
                timeout: timeout || 3000,
                responseType: result_type || "",
                ...other_args_dict,
            };
            return this._request(default_configs, parameters);
        },
        // https://developer.mozilla.org/en-US/docs/web/http/methods/head
        // 相对少用的请求方式
        // 用于测试...
        HEAD(url, timeout = 3000) {
            const configs = {
                method: "HEAD",
                url: url,
                timeout: timeout,
            };
            return this._request(configs, url, result_type);
        },
    };
})();
