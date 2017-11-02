'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'''

import os
import sys
import subprocess

from nosedep import depends

import test_common
task_uui = ''
# Select test group here using @attr
from nose.plugins.attrib import attr
@attr(all=True, regression=True, smoke=True)
class rackhd20_api_post_notification(test_common.unittest.TestCase):
    task_name = "Wsman requester"
    workflow_name="Graph.Service.Poller"

    def test_api_20_notification(self):
        global  task_uui
        data_payload = {
        }

        api_workflow_data = test_common.taskgraphapi('/api/2.0/workflows')
        workflows=api_workflow_data['json']
        for workflow in workflows:
            if workflow["injectableName"]==self.workflow_name:
                tasks = workflow["tasks"]
                for task in tasks:
                    if tasks[task]["friendlyName"]==self.task_name :
                        task_uui = tasks[task]["instanceId"]

        api_data = test_common.taskgraphapi('/api/2.0/notification?taskId='+task_uui+'&maximum=100&value=10&description="Wsman requester"', action="post", payload=data_payload)
        self.assertEqual(api_data['status'], 201,
                         'Incorrect HTTP return code, expected 201, got:' + str(api_data['status']))

    @depends(after=test_api_20_notification)
    def test_api_20_post_get_notification_progress(self):
        global task_uui
        data_payload = {
        }

        api_data = test_common.taskgraphapi(
            '/api/2.0/notification/progress?taskId=' + task_uui + '&maximum=100&value=10&description="Wsman requester"',
            action="post", payload=data_payload)
        self.assertEqual(api_data['status'], 200,
                         'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))
        api_data = test_common.taskgraphapi(
            '/api/2.0/notification/progress?taskId=' + task_uui + '&maximum=100&value=10&description="Wsman requester"')
        self.assertEqual(api_data['status'], 200,
                         'Incorrect HTTP return code, expected 200, got:' + str(api_data['status']))


if __name__ == '__main__':
    test_common.unittest.main()
