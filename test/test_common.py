'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

This is the common function library for functional tests.
'''

import os
import json
import requests
import unittest

def taskgraphapi(command, action='get', payload=[], headers={}):
    '''
    This routine executes a rest API call to the host.

    :param command: the URL for the command
    :param action: rest command (get/post/put/delete)
    :param payload: payload for rest request
    :param headers: headers (JSON dict)
    :param sslverify: ssl Verify (True/False)
    :return:    {'json':result_data.json(), 'text':result_data.text,
                'status':result_data.status_code,
                'headers':result_data.headers,
                'timeout':False}
    '''

    basePath = os.getenv('BASEURL', 'http://172.31.128.1:9030')
    url_command = basePath + command
    sslverify = False

    result_data = None

    headers.update({"Content-Type": "application/json"})

    # Perform rest request
    try:
        if action == "get":
            result_data = requests.get(url_command,
                                       verify=sslverify,
                                       headers=headers)
        if action == "delete":
            result_data = requests.delete(url_command,
                                          data=json.dumps(payload),
                                          verify=sslverify,
                                          headers=headers)
        if action == "put":
            result_data = requests.put(url_command,
                                       data=json.dumps(payload),
                                       headers=headers,
                                       verify=sslverify,
                                       )
        if action == "binary-put":
            headers.update({"Content-Type": "application/x-www-form-urlencoded"})
            result_data = requests.put(url_command,
                                       data=payload,
                                       headers=headers,
                                       verify=sslverify,
                                       )
        if action == "text-put":
            headers.update({"Content-Type": "text/plain"})
            result_data = requests.put(url_command,
                                       data=payload,
                                       headers=headers,
                                       verify=sslverify,
                                       )
        if action == "post":
            result_data = requests.post(url_command,
                                        data=json.dumps(payload),
                                        headers=headers,
                                        verify=sslverify
                                        )
        if action == "binary-post":
            headers.update({"Content-Type": "application/x-www-form-urlencoded"})
            result_data = requests.post(url_command,
                                        data=payload,
                                        headers=headers,
                                        verify=sslverify
                                        )
        if action == "text-post":
            headers.update({"Content-Type": "text/plain"})
            result_data = requests.post(url_command,
                                        data=payload,
                                        headers=headers,
                                        verify=sslverify
                                        )
        if action == "patch":
            result_data = requests.patch(url_command,
                                         data=json.dumps(payload),
                                         headers=headers,
                                         verify=sslverify
                                         )
    except requests.exceptions.Timeout:
        return {'json': {}, 'text': '',
                'status': 0,
                'headers': '',
                'timeout': True}

    try:
        result_data.json()
    except ValueError:
        return {'json': {}, 'text': result_data.text, 'status': result_data.status_code,
                'headers': result_data.headers,
                'timeout': False}
    else:
        return {'json': result_data.json(), 'text': result_data.text,
                'status': result_data.status_code,
                'headers': result_data.headers,
                'timeout': False}
