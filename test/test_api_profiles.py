'''
Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'''

import os
import sys
import subprocess
import test_common

# Select test group here using @attr
from nose.plugins.attrib import attr
@attr(all=True, regression=True, smoke=True)
class rackhd20_api_profiles(test_common.unittest.TestCase):
    def setUp(self):
        # this clears out any existing instance of 'testid' template
        test_common.taskgraphapi("/api/2.0/profiles/library/testid", action="delete")

    def test_api_20_profiles_metadata(self):
        api_data = test_common.taskgraphapi("/api/2.0/profiles/metadata")
        self.assertEqual(api_data['status'], 200, "Was expecting code 200. Got " + str(api_data['status']))
        for item in api_data['json']:
            # check required fields
            for subitem in ['hash', 'id', 'name', 'scope']:
                self.assertGreater(len(item[subitem]), 0, subitem + ' field error')

    def test_api_20_profiles_metadata_ID(self):
        api_data = test_common.taskgraphapi("/api/2.0/profiles/metadata")
        self.assertEqual(api_data['status'], 200, "Was expecting code 200. Got " + str(api_data['status']))
        for item in api_data['json']:
            lib_data = test_common.taskgraphapi("/api/2.0/profiles/metadata/" + item['name'])
            self.assertEqual(lib_data['status'], 200, "Was expecting code 200. Got " + str(lib_data['status']))
            # check required fields
            for subitem in ['hash', 'id', 'name', 'scope']:
                self.assertGreater(len(item[subitem]), 0, subitem + ' field error')

    def test_api_20_profiles_library_ID_put_get_delete(self):   
        payload = "ddd"
        # this test creates a dummy template called 'testid', checks it, then deletes it
        api_data = test_common.taskgraphapi("/api/2.0/profiles/library/testid?scope=global", action="text-put", payload="null")
        self.assertEqual(api_data['status'], 200, "Was expecting code 201. Got " + str(api_data['status']))
        api_data = test_common.taskgraphapi("/api/2.0/profiles/library/testid")
        self.assertEqual(api_data['text'], "null", "Data 'null' was not returned.")
        self.assertEqual(api_data['status'], 200, "Was expecting code 200. Got " + str(api_data['status']))

if __name__ == '__main__':
    test_common.unittest.main()
