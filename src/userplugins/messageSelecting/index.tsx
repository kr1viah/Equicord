import definePlugin from "@utils/types";
import {ChannelStore} from "@webpack/common";
import {Icon} from "@equicordplugins/translatePlus/utils/icon";
import {Message} from "../../../packages/discord-types";
import {enableStyle} from "@api/Styles";
import textStyle from "./highlightStyle.css?managed";

interface ChannelSelectEvent {
    type: "CHANNEL_SELECT";
    channelId: string | null;
    guildId: string | null;
}

function PopOverIcon() {
    return (
        <svg fill="var(--text-default)" width={24} height={24} viewBox={"0 0 64 64"}>
            <rect x="3" y="5" width="60" height="56" rx="2" ry="2" stroke-width="2"/>
            <path d="M7 12l3 3 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    );
}

function handleMessage(message: Message) {
    const domElement = document.getElementById(
        `chat-messages-${message.channel_id}-${message.id}`,
    );
    if (!domElement) return;

    enableStyle(textStyle);
    if (selectedMessages.includes(message)) {
        selectedMessages.splice(selectedMessages.indexOf(message), 1)
        domElement.classList.toggle("messageselector-selected", false)
    } else {
        selectedMessages.push(message)
        selectedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        domElement.classList.toggle("messageselector-selected", true)
    }

}

export const selectedMessages: Message[] = []

export default definePlugin({
    name: "MultiSelect",
    description: "Allows you to select (multiple) messages",
    authors: [{
        name: "kr1v",
        id: 1082702127014625371n
    }],

    onMessageClick(msg, channel, event) {
        if (selectedMessages.length !== 0) {
            handleMessage(msg)
        }
    },

    flux: {
        async CHANNEL_SELECT({ guildId, channelId }: ChannelSelectEvent) {
            selectedMessages.length = 0
        }
    },

    messagePopoverButton: {
        icon: Icon,
        render(message) {
            return {
                label: "Select/unselect",
                icon: PopOverIcon,
                message: message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => {
                    handleMessage(message)
                },
            };
        }
    }
});
