<a name="main"></a>

## main(params) ⇒ <code>object</code>
This function dispatches the request to the content repository, the pipeline, and the static
repository. The preference order is:
1. fetch from the content repository
2. dynamically render using the content repository
3. fetch from the fallback (`static`) repository
4. fetch `/404.html` from the content or fallback repository

**Kind**: global function  
**Returns**: <code>object</code> - the HTTP response  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>object</code> | the URL parameters |
| params.content.owner | <code>string</code> | the GitHub owner of the content (primary) repository |
| params.content.repo | <code>string</code> | the GitHub repo of the content repository |
| params.content.ref | <code>string</code> | the GitHub commit sha or branch name of the content repository |
| params.content.package | <code>string</code> | the OpenWhisk package name used for rendering actions. |
| params.content.index | <code>string</code> | a comma separated list of the directory index files to try when requesting a directory |
| params.static.owner | <code>string</code> | the GitHub owner of the fallback repository |
| params.static.repo | <code>string</code> | the GitHub repo of the fallback repository |
| params.static.ref | <code>string</code> | the GitHub commit sha or branch name of the fallback repository |

