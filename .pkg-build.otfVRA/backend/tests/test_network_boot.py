from types import SimpleNamespace

import api.network_boot as network_boot
import tarfile


def test_normalize_install_mode_defaults_for_unknown_values():
    assert network_boot._normalize_install_mode("rocky_kickstart") == "rocky_kickstart"
    assert network_boot._normalize_install_mode("totally-unknown") == "ubuntu_autoinstall"


def test_default_answer_template_matches_install_mode():
    ubuntu_profile = SimpleNamespace(
        install_mode="ubuntu_autoinstall",
        rootfs_url="",
        provisioning_template=None,
        network=None,
    )
    windows_profile = SimpleNamespace(
        install_mode="windows_autounattend",
        rootfs_url="",
        provisioning_template=None,
        network=None,
    )

    ubuntu_template = network_boot._default_answer_template(ubuntu_profile)
    windows_template = network_boot._default_answer_template(windows_profile)

    assert "autoinstall" in ubuntu_template
    assert "install-agent.sh" in ubuntu_template
    assert "<unattend" in windows_template
    assert "install-agent.ps1" in windows_template


def test_render_ipxe_script_for_image_restore_links_answer_metadata():
    profile = SimpleNamespace(
        id=4,
        name="branch-image-restore",
        install_mode="image_restore",
        firmware_mode="uefi",
        kernel_url="",
        initrd_url="",
        rootfs_url="",
        provisioning_template=SimpleNamespace(name="Branch Golden"),
    )
    network = SimpleNamespace(next_server="http://boot.branch.local")

    script = network_boot._render_ipxe_script(profile, network)

    assert "#!ipxe" in script
    assert "template=Branch Golden" in script
    assert "metadata=http://boot.branch.local/boot/network-boot/profiles/4/answer" in script


def test_artifact_urls_use_network_boot_base():
    profile = SimpleNamespace(id=9)
    network = SimpleNamespace(next_server="boot.branch.local")

    urls = network_boot._artifact_urls(profile, network)

    assert urls["profile_root"] == "http://boot.branch.local/boot/network-boot/profiles/9"
    assert urls["ipxe"].endswith("/boot.ipxe")
    assert urls["answer"].endswith("/answer")


def test_controller_api_base_prefers_explicit_controller_url():
    network = SimpleNamespace(next_server="http://boot.branch.local", controller_url="https://patchmaster-core.example.com")

    assert network_boot._controller_api_base(network) == "https://patchmaster-core.example.com"


def test_normalize_mac_address_accepts_common_formats():
    assert network_boot._normalize_mac_address("AA-BB-CC-DD-EE-FF") == "aa:bb:cc:dd:ee:ff"
    assert network_boot._normalize_mac_address("aabb.ccdd.eeff") == "aa:bb:cc:dd:ee:ff"


def test_assignment_urls_use_public_assignment_path():
    assignment = SimpleNamespace(id=7, network=SimpleNamespace(next_server="http://boot.branch.local"))

    urls = network_boot._assignment_urls(assignment)

    assert urls["assignment_root"] == "http://boot.branch.local/boot/network-boot/assignments/7"
    assert urls["ipxe"].endswith("/boot.ipxe")


def test_session_assignment_urls_append_session_query():
    assignment = SimpleNamespace(id=7, network=SimpleNamespace(next_server="http://boot.branch.local"))

    urls = network_boot._session_assignment_urls(assignment, "sess123")

    assert urls["ipxe"].endswith("/boot.ipxe?session=sess123")
    assert urls["answer"].endswith("/answer?session=sess123")


def test_render_dnsmasq_config_includes_assignment_chain_and_menu():
    network = SimpleNamespace(
        id=1,
        name="Branch A",
        interface_name="bond0.120",
        dhcp_range_start="10.42.120.100",
        dhcp_range_end="10.42.120.199",
        gateway="10.42.120.1",
        dns_servers=["10.42.0.10", "10.42.0.11"],
        next_server="http://boot.branch.local",
        boot_file_bios="undionly.kpxe",
        boot_file_uefi="ipxe.efi",
        is_enabled=True,
    )
    profile = SimpleNamespace(
        id=4,
        name="Ubuntu Auto",
        network_id=1,
        network=network,
        provisioning_template=None,
        install_mode="ubuntu_autoinstall",
        firmware_mode="uefi",
        is_enabled=True,
    )
    assignment = SimpleNamespace(
        id=11,
        network_id=1,
        network=network,
        profile=profile,
        mac_address="aa:bb:cc:dd:ee:ff",
        reserved_ip="10.42.120.50",
        hostname="branch-a-lt-01",
        is_enabled=True,
    )

    config = network_boot._render_dnsmasq_config([network], [profile], [assignment])

    assert "interface=bond0.120" in config
    assert "dhcp-range=set:net1,10.42.120.100,10.42.120.199,12h" in config
    assert "dhcp-host=aa:bb:cc:dd:ee:ff,10.42.120.50,branch-a-lt-01,set:pmassign11" in config
    assert "http://boot.branch.local/boot/network-boot/networks/1/menu.ipxe" in config
    assert "http://boot.branch.local/boot/network-boot/assignments/11/boot.ipxe" in config


def test_render_nginx_config_maps_boot_path_to_bundle_root():
    network = SimpleNamespace(next_server="http://boot.branch.local", is_enabled=True)

    config = network_boot._render_nginx_config([network])

    assert "server_name boot.branch.local;" in config
    assert "location /boot/network-boot/" in config
    assert "alias /var/lib/patchmaster/network-boot/http-boot/;" in config


def test_render_boot_host_install_script_installs_services_and_bundle():
    script = network_boot._render_boot_host_install_script()

    assert "apt-get install -y -qq dnsmasq nginx rsync curl jq" in script
    assert "dnf install -y dnsmasq nginx rsync curl jq" in script
    assert "dnsmasq --test" in script
    assert "nginx -t" in script
    assert "install -D -m 0644 \"${BUNDLE_ROOT}/nginx/patchmaster-network-boot.conf\"" in script


def test_artifact_version_details_are_stable_and_sensitive_to_input():
    network = SimpleNamespace(id=1, name="Branch A", next_server="http://boot.branch.local", controller_url="http://core.local:8000", relay_id=4)
    profiles = [SimpleNamespace(id=2, name="Ubuntu", install_mode="ubuntu_autoinstall", kernel_url="", initrd_url="", rootfs_url="", mirror_repo_id=None)]
    assignments = [SimpleNamespace(id=9, mac_address="aa:bb:cc:dd:ee:ff", reserved_ip="10.0.0.20", hostname="branch-a-01")]

    version_a, checksum_a = network_boot._artifact_version_details(network, profiles, assignments)
    version_b, checksum_b = network_boot._artifact_version_details(network, profiles, assignments)
    changed_assignments = [SimpleNamespace(id=9, mac_address="aa:bb:cc:dd:ee:ff", reserved_ip="10.0.0.21", hostname="branch-a-01")]
    version_c, checksum_c = network_boot._artifact_version_details(network, profiles, changed_assignments)

    assert version_a == version_b
    assert checksum_a == checksum_b
    assert checksum_a != checksum_c
    assert version_c.startswith("nb-")


def test_event_report_command_contains_session_and_event_payload():
    command = network_boot._event_report_command(
        "http://core.local:8000/api/network-boot/events",
        "sess-001",
        "installer_started",
        "answer_template",
        "Boot started",
    )

    assert "sess-001" in command
    assert "installer_started" in command
    assert "http://core.local:8000/api/network-boot/events" in command


def test_build_bundle_buffer_includes_relay_scoped_readme():
    network = SimpleNamespace(
        id=1,
        name="Branch A",
        next_server="http://boot.branch.local",
        controller_url="http://core.local:8000",
        relay_id=7,
        boot_file_bios="undionly.kpxe",
        boot_file_uefi="ipxe.efi",
        interface_name="eth0",
        dhcp_range_start="10.0.0.100",
        dhcp_range_end="10.0.0.150",
        gateway="10.0.0.1",
        dns_servers=[],
        is_enabled=True,
    )
    profile = SimpleNamespace(
        id=3,
        name="Ubuntu Branch",
        install_mode="ubuntu_autoinstall",
        firmware_mode="uefi",
        kernel_url="",
        initrd_url="",
        rootfs_url="",
        network_id=1,
        network=network,
        provisioning_template=None,
        answer_template="",
        is_enabled=True,
    )
    assignment = SimpleNamespace(
        id=8,
        hostname="branch-a-01",
        mac_address="aa:bb:cc:dd:ee:ff",
        reserved_ip="10.0.0.21",
        network_id=1,
        network=network,
        profile=profile,
        is_enabled=True,
    )
    relay = SimpleNamespace(id=7, name="branch-a-relay")

    buffer = network_boot._build_bundle_buffer([network], [profile], [assignment], relay=relay)

    with tarfile.open(fileobj=buffer, mode="r:gz") as bundle:
        readme = bundle.extractfile("README.txt").read().decode("utf-8")
        assert "relay branch-a-relay" in readme
        assert "dnsmasq/patchmaster-network-boot.conf" in bundle.getnames()
