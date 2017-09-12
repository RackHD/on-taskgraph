import os
import shutil
import sys

# Python module names vary depending on nxos version
try:
    from cli import cli
except:
    from cisco import cli

tmp_config_path = "volatile:poap.cfg"
tmp_config_path_unix = "/volatile/poap.cfg"

class CiscoDeployExcept(Exception):
    def __init__(self, message=None):
        super(CiscoDeployExcept, self).__init__(message)

def deploy_startup_config():
    startup_config_uri = '<%= (hasOwnProperty("startupConfigUri") ? startupConfigUri : "" )%>'
    if not startup_config_uri:
        return

    try:
        poap_log("Removing {0}".format(tmp_config_path_unix))
        os.remove(tmp_config_path_unix)
    except:
        poap_log("Removing {0} failed".format(tmp_config_path_unix))

    poap_log("Copying {0} to {1}".format(startup_config_uri, tmp_config_path))
    cli("copy %s %s vrf management" % (startup_config_uri, tmp_config_path))
    poap_log("Copying {0} to running-config".format(tmp_config_path))
    cli("copy %s running-config" % tmp_config_path)
    poap_log("deploy_startup_config finished")

def deploy_boot_images():
    poap_log("deploy_boot_images")

    boot_image_uri = '<%= (hasOwnProperty("bootImageUri") ? bootImageUri : "" )%>'
    if not boot_image_uri:
        poap_log("No boot image URL: {0}".format("<%=bootImageUri%>"))
        return

    poap_log("boot image URL {0}".format("<%=bootImageUri%>"))
    image_dir = "bootflash:poap_images"
    image_dir_new = "%s_new" % image_dir
    image_dir_unix = "/bootflash/poap_images"
    image_dir_new_unix = "%s_new" % image_dir_unix
    image_dir_old_unix = "%s_old" % image_dir_unix

    # Cisco won't let us remove images being used for the current boot,
    # so mark them for deletion on the NEXT upgrade. This means we will have
    # three image versions on disk:
    #     - The current ones (bootflash:poap_images_new/)
    #     - The previous ones (bootflash:poap_images_old/)
    #     - The original ones which we never modify (bootfalsh:)

    if os.path.isdir(image_dir_old_unix):
        shutil.rmtree(image_dir_old_unix)

    if os.path.isdir(image_dir_new_unix):
        os.rename(image_dir_new_unix, image_dir_old_unix)
    else:
        os.mkdir(image_dir_old_unix)

    os.mkdir(image_dir_new_unix)

    # Download images
    poap_log("Downloading images")
    image_path = "%s/<%=bootImage%>" % image_dir_new
    kickstart_path = "%s/<%=kickstartImage%>" % image_dir_new
    kickstart_uri = "<%=kickstartUri%>"

    poap_log("From: %s to %s" % (kickstart_uri, kickstart_path))
    cli("copy %s %s vrf management" % (kickstart_uri, kickstart_path))
    poap_log("From: %s to %s" % (boot_image_uri, image_path))
    cli("copy %s %s vrf management" % (boot_image_uri, image_path))

    # Set boot variables, system image first
    cli("configure terminal ; boot system %s" % image_path)
    cli("configure terminal ; boot kickstart %s" % kickstart_path)


log_filename = "/bootflash/poap.log"

# setup log file and associated utils
poap_log_file = open(log_filename, "a+")

def poap_log (info):
    poap_log_file.write("cisco-deploy-config-and-images.py:")
    poap_log_file.write(info)
    poap_log_file.write("\n")
    poap_log_file.flush()
    print "poap_py_log:" + info
    sys.stdout.flush()

def poap_log_close ():
    poap_log_file.close()

def main():
    try:
        deploy_startup_config()
        deploy_boot_images()
    except Exception as e:
        poap_log("Deploy startup or boot failed")
        poap_log_close()
        # Don't swallow exceptions otherwise the Cisco switch will think the POAP was a success
        # and proceed to boot rather than retrying
        raise e

    # Copying to scheduled-config is necessary for POAP to exit on the next
    # reboot and apply the configuration. We want to merge the running-config
    # changes made by both the startup-config deployment
    # and the boot image deployment.
    # The issue is if we copy to scheduled-config MORE THAN ONCE it will
    # trigger POAP/config application MORE THAN ONCE as well, which we don't want.
    # So we have to do all these operations in the same script, that way they
    # are not order-dependant.
    poap_log("Deploying images")
    poap_log("From: %s to %s" % ("running-config", "startup-config"))
    cli("copy running-config startup-config")
    poap_log("From: %s to %s" % ("running-config", tmp_config_path))
    cli("copy running-config %s" % tmp_config_path)
    poap_log("From: %s to %s" % (tmp_config_path, "scheduled-config"))
    cli("copy %s scheduled-config" % tmp_config_path)

    poap_log_close()
